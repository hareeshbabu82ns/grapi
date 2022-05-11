/* eslint-disable no-console */
import chalk from 'chalk'

import { Field, Model, ModelRelation, RelationField, RelationType } from '../dataModel'
import { flatten, isEmpty, mapValues, values } from '../lodash'

// constants
const SPACE = ' '

const graphqlType = ( field: Field ): string => {
    let value = field.getTypename()

    if ( field.isList() ) {
        value = field.isNonNullItem() ? `[${value}!]` : `[${value}]`
    }

    if ( field.isNonNull() ) {
        value = `${value}!`
    }
    return value
}

const fieldMessages = ( fields: Record<string, Field> ): string[] => {
    return values( mapValues( fields, ( field, key ) => {
        const relationMessage = field instanceof RelationField ? `@relation(name: ${field.getRelationName()})` : ''
        // tslint:disable-next-line:max-line-length
        return `${SPACE.repeat( 4 )}${chalk.green( 'Field' )}: ${key} ${chalk.cyan( `\`${graphqlType( field )}\`` )} ${relationMessage}`
    } ) )
}

const modelMessages = ( models: Model[] ): string[] => {
    return flatten( models.map( model => {
        const modelType = model.isObjectType() ? 'ObjectModel' : 'Model'
        // tslint:disable-next-line:max-line-length
        const title = `${SPACE.repeat( 4 )}- ${modelType} ${chalk.bold( model.getNamings().capitalSingular )} ${chalk.gray( `(generated from '${model.getName()}')` )}`
        return [ title, ...fieldMessages( model.getFields() ), '\n' ]
    } ) )
}

const getReadableNameOfRelationType = ( relationType: RelationType ): string => {
    switch ( relationType ) {
    case RelationType.uniManyToOne:
        return 'Unidirectional Many-to-One'
    case RelationType.uniOneToMany:
        return 'Unidirectional One-to-Many'
    case RelationType.uniOneToOne:
        return 'Unidirectional One-to-One'
    case RelationType.biOneToOne:
        return 'Bidirectional One-to-One'
    case RelationType.biOneToMany:
        return 'Bidirectional One-to-Many'
    case RelationType.biManyToMany:
        return 'Bidirectional Many-to-Many'
    default:
        throw new Error( `no relationType ${relationType} found` )
    }
}

const getSidesOfRelation = ( relation: ModelRelation ): string => {
    const sourceName = relation.source.getNamings().capitalSingular
    const targetName = relation.target.getNamings().capitalSingular
    let relationSymbol: string

    switch ( relation.type ) {
    case RelationType.uniManyToOne:
        relationSymbol = '*-1'
        break

    case RelationType.uniOneToMany:
    case RelationType.biOneToMany:
        relationSymbol = '1-*'
        break

    case RelationType.uniOneToOne:
    case RelationType.biOneToOne:
        relationSymbol = '1-1'
        break

    case RelationType.biManyToMany:
        relationSymbol = '*-*'
        break
    default:
        throw new Error( `no relationType ${relation.type} found` )
    }

    return `${relationSymbol} on \`${sourceName}\`-\`${targetName}\``
}

const relationMessages = ( relations: ModelRelation[] ): string[] => {
    return flatten( relations.map( relation => {
        const title = `${SPACE.repeat( 4 )}Relation ${chalk.bold( relation.name )}`
        const type = `${SPACE.repeat( 6 )}* ${chalk.cyan( 'Type' )}: ${getReadableNameOfRelationType( relation.type )}`
        const sides = `${SPACE.repeat( 6 )}* ${chalk.cyan( 'Relationship' )}: ${getSidesOfRelation( relation )}`
        return [ title, type, sides, '\n' ]
    } ) )
}

export const printModels = ( models: Model[] ): void => {
    console.log( chalk.bold( `${SPACE.repeat( 2 )}- Grapi Models` ) )
    modelMessages( models ).forEach( line => console.log( line ) )
}

export const printRelations = ( relations: ModelRelation[] ): void => {
    if ( isEmpty( relations ) ) {
        return
    }
    console.log( chalk.bold( `${SPACE.repeat( 2 )}- Relations` ) )
    relationMessages( relations ).forEach( line => console.log( line ) )
}
