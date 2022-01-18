import { ListMutable, MapMutable, Mutation } from '..'
import { DirectiveModelAction, Field, RelationField, RelationType } from '../dataModel'
import Model from '../dataModel/model'
import ObjectField from '../dataModel/objectField'
import { DataModelType } from '../dataModel/type'
import { Hook, UpdateContext } from '../hooks/interface'
import { capitalize, forEach, get, upperFirst } from '../lodash'
import BaseTypePlugin from './baseType'
import CreatePlugin from './create'
import { Context, Plugin } from './interface'
import { MutationFactory } from './mutation'
import WhereInputPlugin from './whereInput'

const createObjectInputField = ( prefix: string, field: ObjectField, context: Context ): string[] => {
    const { root } = context
    const content: string[] = []
    forEach( field.getFields(), ( nestedField, name ) => {
        if ( nestedField.isScalar() ) {
            content.push( `${name}: ${nestedField.getTypename()}` )
            return
        }

        if ( nestedField instanceof ObjectField ) {
            const fieldWithPrefix = `${prefix}${upperFirst( name )}`
            const typeFields = createObjectInputField( fieldWithPrefix, nestedField, context )
            const objectInputName = `${fieldWithPrefix}UpdateInput`
            root.addInput( `input ${objectInputName} {
                    ${typeFields.join( ' ' )}
                }`
            )
            content.push( `${name}: ${objectInputName}` )
            return
        }

        // skip relation field
    } )
    return content
}

const createInputField = (
    model: Model,
    context: Context,
    getCreateInputName: ( model: Model ) => string,
    getWhereInputName: ( model: Model ) => string,
    getWhereUniqueInputName: ( model: Model ) => string,
    getMutationFactoryFromModel: ( model: Model ) => MutationFactory,
    withoutField: string = undefined,
    recursive: boolean = true
): string[] => {
    const { root } = context
    const fields = model.getFields()
    const content: string[] = []
    const mutationFactory = getMutationFactoryFromModel( model )

    const relationUpdateInputs = (
        relationNamings: string,
        relationName: string,
        relationTo: Model,
        fieldName: string,
        isList: boolean,
        exceptionField: string = undefined
    ) => {
        forEach( relationTo.getFields(), ( modelField: Field, keyField: string,  ) => {
            if ( ( modelField instanceof RelationField && modelField.getRelationName() === relationName ) ) {
                exceptionField = keyField
                return false
            }
        } )
        const relationField = capitalize( exceptionField )
        const relationInput = `${relationNamings}UpdateWithout${relationField}Input`
        const inputField = createInputField(
            relationTo,
            context,
            getCreateInputName,
            getWhereInputName,
            getWhereUniqueInputName,
            relationTo.getCreateMutationFactory,
            exceptionField,
            false
        )
        const relationCreateInput = `${relationNamings}Update${isList ? `Many` : `One` }Without${ relationField }Input`
        const whereUnique = `${getWhereUniqueInputName( relationTo )}`
        root.addInput(
            `input ${relationInput} { 
                ${ inputField } 
            }`
        )
        if ( isList ) {
            root.addInput( `input ${relationCreateInput} {
                create: [${relationInput}]
                connect: [${whereUnique}]
                disconnect: [${whereUnique}]
                delete: [${whereUnique}]
            }` )
        } else {
            root.addInput( `input ${relationCreateInput} {
                create: ${relationInput}
                connect: ${whereUnique}
                disconnect: Boolean
                delete: Boolean
            }` )
        }
        content.push( `${fieldName}: ${relationCreateInput}` )
    }

    forEach( fields, ( field, name ) => {

        if ( field.isAutoGenerated() ) {
            return
        }

        if ( withoutField && withoutField === name ) {
            return
        }

        if ( field.isScalar() ) {
            let fieldType: string
            if ( field.isList() ) {
                // wrap with set field
                const listOperationInput = `${field.getTypename()}ListFieldUpdateInput`
                root.addInput(
                    `input ${listOperationInput} {
                        set: [${field.getTypename()}]
                        add: [${field.getTypename()}]
                        remove: [${field.getTypename()}]
                    }`
                )
                fieldType = listOperationInput
                mutationFactory.markArrayField( name )
            } else {
                fieldType = field.getTypename()
            }
            content.push( `${name}: ${fieldType}` )
            return
        }

        if ( field instanceof ObjectField ) {
            // create input for nested object
            const fieldWithPrefix = `${model.getNamings().capitalSingular}${upperFirst( name )}`
            const typeFields = createObjectInputField( fieldWithPrefix, field, context )
            const objectInputName = `${fieldWithPrefix}UpdateInput`
            root.addInput( `input ${objectInputName} {
                    ${typeFields.join( ' ' )}
                }`
            )

            let fieldType: string
            if ( field.isList() ) {
                // wrap with set field
                const listOperationInput = `${fieldWithPrefix}UpdateListInput`
                root.addInput(
                    `input ${listOperationInput} {
                        set: [${objectInputName}]
                        add: [${objectInputName}]
                        remove: [${objectInputName}]                        
                    }`
                )
                fieldType = listOperationInput
                mutationFactory.markArrayField( name )
            } else {
                fieldType = objectInputName
            }

            content.push( `${name}: ${fieldType}` )
            return
        }

        // relation
        // add create, connect, disconnect, delete for relation
        const isRelation = field instanceof RelationField
        const isList = field.isList()
        if ( isRelation && ! isList ) {
            // to-one
            const relationTo = ( field as RelationField ).getRelationTo()
            const relationType = ( field as RelationField ).getRelationType()
            const relationName = ( field as RelationField ).getRelationName()
            const relationNamings = relationTo.getNamings().capitalSingular
            if ( recursive && relationType === RelationType.biOneToOne ) {
                relationUpdateInputs( relationNamings, relationName, relationTo, name, false )
            } else {
                const relationInputName = `${relationTo.getTypename()}UpdateOneInput`
                root.addInput( `input ${relationInputName} {
                    create: ${getCreateInputName( relationTo )}
                    connect: ${getWhereUniqueInputName( relationTo )}
                    disconnect: Boolean
                    delete: Boolean
                }` )
                content.push( `${name}: ${relationInputName}` )
            }
            return
        }

        if ( isRelation && isList ) {
            // to-many
            const relationTo = ( field as RelationField ).getRelationTo()

            const relationType = ( field as RelationField ).getRelationType()
            const relationName = ( field as RelationField ).getRelationName()
            const relationNamings = relationTo.getNamings().capitalSingular
            if ( recursive && relationType === RelationType.biOneToMany || relationType === RelationType.biManyToMany ) {
                relationUpdateInputs( relationNamings, relationName, relationTo, name, true )
            } else {
                const whereUnique = getWhereUniqueInputName( relationTo )
                const relationInputName = `${relationTo.getTypename()}UpdateManyInput`

                root.addInput( `input ${relationInputName} {
                    create: [${getCreateInputName( relationTo )}]
                    connect: [${whereUnique}]
                    disconnect: [${whereUnique}]
                    delete: [${whereUnique}]
                }` )
                content.push( `${name}: ${relationInputName}` )
            }
            return
        }
    } )

    return content
}

export default class UpdatePlugin implements Plugin {
    private whereInputPlugin: WhereInputPlugin;
    private baseTypePlugin: BaseTypePlugin;
    private createPlugin: CreatePlugin;
    private hook: Hook;

    constructor( {
        hook,
    }: {
        hook: Hook;
    } ) {
        this.hook = hook
    }

    public setPlugins( plugins: Plugin[] ): void {
        this.whereInputPlugin = plugins.find(
            plugin => plugin instanceof WhereInputPlugin ) as WhereInputPlugin
        this.baseTypePlugin = plugins.find(
            plugin => plugin instanceof BaseTypePlugin ) as BaseTypePlugin
        this.createPlugin = plugins.find(
            plugin => plugin instanceof CreatePlugin ) as CreatePlugin
    }

    public visitModel( model: Model, context: Context ): void {
        const { root } = context
        // object
        // if ( model.isObjectType() ) {
        //     const objectMutationName = this.getInputName( model );
        //     const objectInputName = this.generateUpdateInput( model, context );
        //     const objectReturnType = this.createObjectReturnType( model, context );
        //     root.addMutation( `${objectMutationName}(data: ${objectInputName}!): ${objectReturnType}` );
        //     return;
        // }

        // list
        const returnType = this.baseTypePlugin.getTypename( model )
        // Find if authDirective is enable
        const directives = model.getDirectives( DirectiveModelAction.Update )
        // update
        const mutationName = UpdatePlugin.getInputName( model )
        const inputName = this.generateUpdateInput( model, context )
        const whereUniqueInput = this.whereInputPlugin.getWhereUniqueInputName( model )
        root.addMutation( `${mutationName}( where: ${whereUniqueInput}!, data: ${inputName}! ): ${returnType}!${ directives }` )
    }

    public resolveInMutation( { model, dataSource }: {model: Model; dataSource: ListMutable & MapMutable} ): any {
        const mutationName = UpdatePlugin.getInputName( model )
        const wrapUpdate = get( this.hook, [ model.getName(), 'wrapUpdate' ] )

        // // object
        // if ( model.isObjectType() ) {
        //     return {
        //         [mutationName]: async ( root, args, context ): Promise<any> => {
        //             const data = { ...args.data };
        //
        //             // no relationship or other hooks
        //             if ( !wrapUpdate ) {
        //                 await dataSource.updateMap( this.createMutation( model, data ) );
        //                 return { success: true };
        //             }
        //
        //             const updateContext: UpdateContext = {
        //                 where: args.where,
        //                 data,
        //                 response: {},
        //                 graphqlContext: context,
        //             };
        //             await wrapUpdate( updateContext, async ctx => {
        //                 await dataSource.updateMap( this.createMutation( model, ctx.data ) );
        //             } );
        //             return { success: true };
        //         },
        //     };
        // }

        // list
        return {
            [mutationName]: async ( root, args, context ): Promise<any> => {
                // args may not have `hasOwnProperty`.
                const updatedObject = await model.getDataSource().findOne( { where: this.whereInputPlugin.parseUniqueWhere( args.where ) } )
                if ( !updatedObject ) {
                    throw new Error( `No Node for the model ${ capitalize( model.getName() ) } with unique field.` )
                }
                const whereUnique = { id: { eq: updatedObject.id } }
                const data = this.setUpdatedAtDirective( model, args.data )

                // no relationship or other hooks
                if ( !wrapUpdate ) {
                    return await dataSource.update( whereUnique, this.createMutation( model, data ), context )
                }

                // wrap
                // put mutationFactory to context
                // so hooks can access it
                // todo: find a better way to share the mutationFactory
                const updateContext: UpdateContext = {
                    where: args.where,
                    data,
                    response: {},
                    graphqlContext: context,
                }
                await wrapUpdate( updateContext, async ctx => {
                    updateContext.response = await dataSource.update( whereUnique, this.createMutation( model, ctx.data ), context )
                } )
                return updateContext.response
            },
        }
    }

    private generateUpdateInput( model: Model, context: Context ): string {
        const inputName = `${model.getNamings().capitalSingular}UpdateInput`
        const inputField = createInputField(
            model,
            context,
            this.createPlugin.getCreateInputName,
            this.whereInputPlugin.getWhereInputName,
            this.whereInputPlugin.getWhereUniqueInputName,
            model.getUpdateMutationFactory,
        )
        const input = `input ${inputName} {
            ${ inputField }
        }`
        context.root.addInput( input )
        return inputName
    }

    private static getInputName( model: Model ): string {
        return `update${model.getNamings().capitalSingular}`
    }

    // private createObjectReturnType( model: Model, context: Context ): string {
    //     const typename = this.getReturnTypename( model );
    //     const type = `type ${typename} {
    //         success: Boolean
    //     }`;
    //     context.root.addObjectType( type );
    //     return typename;
    // }
    //
    // private getReturnTypename( model: Model ): string {
    //     return `${model.getNamings().capitalSingular}UpdateResponse`;
    // }

    private createMutation = ( model: Model, payload: any ): Mutation => {
        const mutationFactory = model.getUpdateMutationFactory()
        return mutationFactory.createMutation( payload )
    };

    private setUpdatedAtDirective = ( model: Model, data ): any => {
        const fields = model.getFields()
        forEach( fields, ( field: Field, name: string ) => {
            if ( field.isUpdatedAt() && field.getTypename() === DataModelType.DATE_TIME ) {
                data[name] = new Date()
            }
        } )

        return data
    }
}
