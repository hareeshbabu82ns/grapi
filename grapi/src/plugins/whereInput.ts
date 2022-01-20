import { Operator, RelationWhere, Where } from '..'
import { MODEL_DIRECTIVE, MODEL_DIRECTIVE_SOURCE_KEY } from '../constants'
import { ObjectField, RelationField } from '../dataModel'
import Field from '../dataModel/field'
import Model from '../dataModel/model'
import { DataModelType, FilterListObject, FilterListScalar } from '../dataModel/type'
import { RelationWhereConfig } from '../helper'
import { forEach, get, isEmpty, map, mapValues, reduce, size } from '../lodash'
import RootNode from '../rootNode'
import { inputDateTimeBetweenName, inputFloatBetweenName, inputIntBetweenName } from './constants'
import { Context, Plugin } from './interface'
import { parseRelationConfig } from './utils'

// constants
const UNDERSCORE = '_'
const DOUBLE_UNDERSCORE = '__'

export default class WhereInputPlugin implements Plugin {
    public visitModel( model: Model, context: Context ): void {
        // object type model dont need whereInput
        if ( model.isObjectType() ) {
            return
        }

        // list model
        const { root } = context

        // add where input
        const modelWhereInputName = this.getWhereInputName( model )
        // add filter: https://www.opencrud.org/#sec-Data-types
        const whereInput = `input ${modelWhereInputName} {
            OR: [${modelWhereInputName}!]
            AND: [${modelWhereInputName}!]
            ${this.createWhereFilter( root, model.getFields() )}
        }`
        root.addInput( whereInput )

        // add where unique input
        // only use the unique field
        const modelWhereUniqueInputName = this.getWhereUniqueInputName( model )
        const whereUniqueInput = `input ${modelWhereUniqueInputName} {
            ${ this.createWhereUniqueFilter( model.getName(), model.getFields() ) }
        }`
        root.addInput( whereUniqueInput )
    }

    public getWhereInputName( model: Model ): string {
        return `${model.getNamings().capitalSingular}WhereInput`
    }

    public getWhereUniqueInputName( model: Model ): string {
        return `${model.getNamings().capitalSingular}WhereUniqueInput`
    }

    public parseUniqueWhere( where: Record<string, any> ): Where {
        if ( isEmpty( where ) ) {
            throw new Error( 'You provided an invalid argument for the where selector on Entity. Please provide exactly one unique field and value.' )
        }
        return mapValues( where, value => {
            return { [Operator.eq]: value }
        } ) as Where
    }

    public parseWhere( where: Record<string, any>, model: Model ): Where {
        // parse where: {name: value, price_gt: value}
        // to {name: {eq: value}, price: {gt: value}}
        return WhereInputPlugin.parseWhereIterate( where, model )
    }

    public static parseWhereIterate( where: Record<string, any>, model: Model ): Where {
        return reduce( where, ( result, value, key ) => {
            if ( key === Operator.or || key === Operator.and  ) {
                value = map( value, ( where: Where ) => {
                    return this.parseWhereIterate( where, model )
                } )
                return { [ key as Operator ]: value }
            }
            const { operator } = WhereInputPlugin.getNameAndOperator( key )
            const { fieldName } = WhereInputPlugin.getNameAndOperator( key )
            const field: RelationField = model.getField( fieldName ) as RelationField
            if ( field && field.getType() === DataModelType.RELATION ) {
                const relationTo: Model = field.getRelationTo()
                const metadataField: Record<string, any> = parseRelationConfig( field.getRelationConfig( ) )
                let filter: FilterListObject
                if ( field.isList() ) {
                    if ( size( value ) > 1 ) {
                        throw new Error( `There can be only one input field named Filter${ field.getTypename() }` )
                    }
                    const { some, none, every } = value
                    if ( some ) {
                        filter = FilterListObject.SOME
                    } else if ( none ) {
                        filter = FilterListObject.NONE
                    } else {
                        filter = FilterListObject.EVERY
                    }
                    value = some || none || every
                }
                result[fieldName] = {
                    filters: WhereInputPlugin.parseWhereIterate( value, relationTo ),
                    sourceKey: get( model.getMetadata( MODEL_DIRECTIVE ), MODEL_DIRECTIVE_SOURCE_KEY ),
                    targetKey: get( relationTo.getMetadata( MODEL_DIRECTIVE ), MODEL_DIRECTIVE_SOURCE_KEY ),
                    relation: {
                        foreignKey: get( metadataField, `foreignKey` ),
                        source: model.getName(),
                        target: relationTo.getName(),
                        side: get( metadataField, `side` ),
                        list: field.isList(),
                        filter,
                        ship: field.getRelation(),
                        type: field.getRelationType()
                    } as RelationWhereConfig
                } as RelationWhere
                return result
            }
            if ( result[fieldName] ) {
                throw new Error( `There can be only one input field named ${ fieldName }_${ operator }` )
            }
            if ( field && field.getType() === DataModelType.OBJECT ) {
                forEach( value, ( val, key )=>{
                    const { operator } = WhereInputPlugin.getNameAndOperator( key )
                    const { fieldName:subFieldName } = WhereInputPlugin.getNameAndOperator( key )
                    if( key === FilterListScalar.ELEMENT_MATCH ){
                        const emResult = {}
                        forEach( val, ( val, key )=>{
                            const { operator } = WhereInputPlugin.getNameAndOperator( key )
                            const { fieldName } = WhereInputPlugin.getNameAndOperator( key )
                            emResult[fieldName] = { [operator]:val }
                        } )
                        result[fieldName] = { [FilterListObject.ELEMENT_MATCH]: emResult }
                    }else
                        result[ `${fieldName}.${subFieldName}` ] = { [ operator ]: val }
                } )
                return result
            }
            if ( field.isList() ) {
                if ( size( value ) > 1 ) {
                    throw new Error( `There can be only one input field named Filter${ field.getTypename() }` )
                }
                result[ fieldName ] = this.parseFilterListScalar( value )
                return result
            }
            result[ fieldName ] = { [ operator ]: value }
            return result
        }, {} as any )
    }

    private static parseFilterListScalar( where:Record<string, any> ):Record<string, any>{
        const resValue = {}
        forEach( where, ( value, filter ) => {
            let op = ''
            let val:any = value
            switch( filter ){
            case FilterListScalar.HAS:
                op = Operator.all
                val = value || []
                break
            case FilterListScalar.HASNOT:
                op = Operator.notIn
                val = value || []
                break
            case FilterListScalar.GT:
                op = Operator.gt
                break
            case FilterListScalar.GTE:
                op = Operator.gte
                break
            case FilterListScalar.LT:
                op = Operator.lt
                break
            case FilterListScalar.LTE:
                op = Operator.lte
                break
            case FilterListScalar.SIZE:
                op = Operator.size
                break
            case FilterListScalar.ELEMENT_MATCH:
                op = Operator.elementMatch
                val = this.parseFilterListScalar( val )
                break
            }
            resValue[op] = val
        } )
        return resValue
    }

    private static getNameAndOperator( field: string ): {fieldName: string; operator: Operator; object?: string} {
        // substitute '__' object name field name from 'obj__price_gt' to 'obj.price_gt'
        field = field.replace( DOUBLE_UNDERSCORE, '.' )

        // split field name and operator from 'price_gt'
        const lastUnderscoreIndex = field.lastIndexOf( UNDERSCORE )

        // no underscore in field, it's a equal operator
        if ( lastUnderscoreIndex < 0 ) {
            return {
                fieldName: field,
                operator: Operator.eq,
            }
        }

        // slice the operator
        const operator = field.slice( lastUnderscoreIndex + 1 )

        // validate the operator
        const validOperator: Operator = Operator[operator]
        if ( !validOperator ) {
            throw new Error( `Operator ${operator} no support` )
        }
        const fieldName = field.slice( 0, lastUnderscoreIndex )
        return { fieldName, operator: validOperator }
    }

    private createWhereFilter( root: RootNode, fields: Record<string, Field>, prefix: string = '' ): string {
        // create equals on scalar fields
        let inputFields: Array<{fieldName: string; type: string}> = []
        const objectFilters: Array<string> = []
        forEach( fields, ( field, name ) => {
            const fieldName : string = prefix + name
            const typeName: string = field.getTypename()
            if ( field.isList() ) {
                switch ( field.getType() ) {
                case DataModelType.INT:
                case DataModelType.FLOAT:
                    // TODO: remove unwanted items from ELEMENT_MATCH (like HAS, HASNOT, SIZE ...)
                    root.addInput( `input FilterScalar${typeName}ElementMatch {
                        ${FilterListScalar.GT}: ${typeName}
                        ${FilterListScalar.GTE}: ${typeName}
                        ${FilterListScalar.LT}: ${typeName}
                        ${FilterListScalar.LTE}: ${typeName}
                    }` )
                    root.addInput( `input FilterScalar${typeName}List { 
                                ${FilterListScalar.HAS}: [ ${typeName} ! ]
                                ${FilterListScalar.HASNOT}: [ ${typeName} ! ]
                                ${FilterListScalar.GT}: ${typeName}
                                ${FilterListScalar.GTE}: ${typeName}
                                ${FilterListScalar.LT}: ${typeName}
                                ${FilterListScalar.LTE}: ${typeName}
                                ${FilterListScalar.SIZE}: Int
                                ${FilterListScalar.ELEMENT_MATCH}: FilterScalar${typeName}ElementMatch
                            }` )
                    inputFields.push( {
                        fieldName: fieldName,
                        type: `FilterScalar${typeName}List`,
                    } )
                    break
                case DataModelType.ENUM:
                case DataModelType.STRING:
                case DataModelType.ID:
                    root.addInput( `input FilterScalar${typeName}List { 
                        ${FilterListScalar.HAS}: [ ${typeName} ! ]
                        ${FilterListScalar.HASNOT}: [ ${typeName} ! ]
                        ${FilterListScalar.SIZE}: Int
                    }` )
                    inputFields.push( {
                        fieldName: fieldName,
                        type: `FilterScalar${typeName}List`,
                    } )
                    break
                case DataModelType.CUSTOM_SCALAR:
                    root.addInput( `input FilterScalar${typeName}List { 
                        ${FilterListScalar.HAS}: [ ${typeName} ! ]
                        ${FilterListScalar.HASNOT}: [ ${typeName} ! ]
                    }` )
                    inputFields = WhereInputPlugin.createWhereFilterListCustomScalars( inputFields, typeName, fieldName )
                    break
                case DataModelType.RELATION:
                    root.addInput( `input Filter${typeName} { 
                        some: ${typeName}WhereInput 
                        every: ${typeName}WhereInput 
                        none: ${typeName}WhereInput 
                    }` )
                    inputFields.push( {
                        fieldName: fieldName,
                        type: `Filter${typeName}`,
                    } )
                    break
                case DataModelType.OBJECT:
                    const objectFields = ( field as ObjectField ).getFields()
                    root.addInput( `input FilterObject${typeName}ElementMatch {
                        ${this.createWhereFilter( root, objectFields )}
                    }` )                    
                    root.addInput( `input FilterObject${typeName}List {
                        ${this.createWhereFilter( root, objectFields )}
                        ${FilterListScalar.ELEMENT_MATCH}: FilterObject${typeName}ElementMatch
                    }` )
                    inputFields.push( {
                        fieldName: fieldName,
                        type: `FilterObject${typeName}List`,
                    } )
                    break
                }
            } else {
                switch ( field.getType() ) {
                case DataModelType.STRING:
                    inputFields.push( ...WhereInputPlugin.parseEqFilter( fieldName, typeName ) )
                    inputFields.push( ...WhereInputPlugin.parseContainsFilter( fieldName, typeName ) )
                    inputFields.push( ...WhereInputPlugin.parseInFilter( fieldName, typeName ) )
                    break
                case DataModelType.INT:
                    inputFields.push( ...WhereInputPlugin.parseEqFilter( fieldName, typeName ) )
                    inputFields.push( ...WhereInputPlugin.parseGtLtInFilter( fieldName, typeName ) )
                    inputFields.push( {
                        fieldName: `${fieldName}_between`, type: inputIntBetweenName,
                    } )
                    break
                case DataModelType.FLOAT:
                    inputFields.push( ...WhereInputPlugin.parseEqFilter( fieldName, typeName ) )
                    inputFields.push( ...WhereInputPlugin.parseGtLtInFilter( fieldName, typeName ) )
                    inputFields.push( {
                        fieldName: `${fieldName}_between`, type: inputFloatBetweenName,
                    } )
                    break
                case DataModelType.ENUM:
                    inputFields.push( ...WhereInputPlugin.parseEqFilter( fieldName, typeName ) )
                    inputFields.push( ...WhereInputPlugin.parseContainsFilter( fieldName, 'String' ) )
                    break
                case DataModelType.ID:
                    inputFields.push( ...WhereInputPlugin.parseEqFilter( fieldName, typeName ) )
                    inputFields.push( ...WhereInputPlugin.parseInFilter( fieldName, typeName ) )
                    break
                case DataModelType.BOOLEAN:
                    inputFields.push( ...WhereInputPlugin.parseEqFilter( fieldName, typeName ) )
                    break
                case DataModelType.CUSTOM_SCALAR:
                    inputFields = WhereInputPlugin.createWhereFilterCustomScalars( inputFields, typeName, fieldName )
                    break
                case DataModelType.RELATION:
                    inputFields.push( {
                        fieldName: fieldName,
                        type: `${typeName}WhereInput`,
                    } )
                    break
                case DataModelType.OBJECT:
                    const objectFields = ( field as ObjectField ).getFields()
                    // objectFilters.push( this.createWhereFilter( root, objectFields, fieldName + DOUBLE_UNDERSCORE ) )
                    root.addInput( `input FilterObject${typeName}List {
                        ${this.createWhereFilter( root, objectFields )}
                    }` )
                    inputFields.push( {
                        fieldName: fieldName,
                        type: `FilterObject${typeName}List`,
                    } )                    
                    break
                }
            }
        } )
        const iFieldsStr: string = inputFields.map( ( { fieldName, type } ) => `${fieldName}: ${type}` ).join( ' ' )
        return `${iFieldsStr}  ${objectFilters}`
    }

    private static createWhereFilterListCustomScalars ( inputFields:  Array<{fieldName: string; type: string}>, typeName: string, name: string ): Array<{fieldName: string; type: string}> {
        // TODO Maybe this is the same for all, consider remove this method
        switch ( typeName ) {
        case DataModelType.URL:
        case DataModelType.EMAIL:
        case DataModelType.JSON:
            inputFields.push( {
                fieldName: name,
                type: `FilterScalar${typeName}List`,
            } )
            break
        case DataModelType.DATE_TIME:
            break

        }
        return inputFields
    }

    private static createWhereFilterCustomScalars ( inputFields:  Array<{fieldName: string; type: string}>, typeName: string, name: string ): Array<{fieldName: string; type: string}> {
        switch ( typeName ) {
        case DataModelType.URL:
        case DataModelType.EMAIL:
            inputFields.push( ...WhereInputPlugin.parseEqFilter( name, typeName ) )
            inputFields.push( ...WhereInputPlugin.parseContainsFilter( name, typeName ) )
            break
        case DataModelType.DATE_TIME:
            inputFields.push( ...WhereInputPlugin.parseEqFilter( name, typeName ) )
            inputFields.push( ...WhereInputPlugin.parseGtLtInFilter( name, typeName ) )
            inputFields.push( {
                fieldName: `${name}_between`, type: inputDateTimeBetweenName,
            } )
            break
        case DataModelType.JSON:
            inputFields.push( ...WhereInputPlugin.parseObjectFilter( name, typeName ) )
            break
        }
        return inputFields
    }

    private createWhereUniqueFilter( modelName: string, fields: Record<string, Field> ): string {
        // create equals on scalar fields
        const inputFields: Array<{fieldName: string; type: string}> = []
        forEach( fields, ( field, name ) => {
            if ( field.isUnique() ) {
                inputFields.push( {
                    fieldName: name,
                    type: field.getTypename(),
                } )
            }
        } )

        if ( isEmpty( fields ) ) {
            throw new Error( `no unique field find in model ${modelName}` )
        }
        return inputFields.map( ( { fieldName, type } ) => `${fieldName}: ${type}` ).join( ' ' )
    }

    private static parseEqFilter ( name: string, type: string ): Array<{ fieldName: string; type: string } > {
        return [ { fieldName: name, type }, { fieldName: `${name}_eq`, type }, { fieldName: `${name}_neq`, type } ]
    }

    private static parseContainsFilter ( name: string, type: string ): Array<{ fieldName: string; type: string } > {
        return [ { fieldName: `${name}_contains`, type }, { fieldName: `${name}_notcontains`, type } ]
    }

    private static parseInFilter ( name: string, type: string ): Array<{ fieldName: string; type: string } > {
        return [
            { fieldName: `${name}_in`, type: `[ ${type} ]` }
        ]
    }

    private static parseGtLtInFilter ( name: string, type: string ): Array<{ fieldName: string; type: string } > {
        return [
            { fieldName: `${name}_gt`, type },
            { fieldName: `${name}_gte`, type },
            { fieldName: `${name}_lt`, type },
            { fieldName: `${name}_lte`, type },
            { fieldName: `${name}_in`, type: `[ ${type} ]` }
        ]
    }

    private static parseObjectFilter ( name: string, type: string ): Array<{ fieldName: string; type: string }> {
        return [
            { fieldName: `${name}_object`, type }
        ]
    }

}
