import {
    DirectiveNode,
    DocumentNode,
    FieldDefinitionNode,
    GraphQLBoolean,
    GraphQLFloat,
    GraphQLID,
    GraphQLInt,
    GraphQLString,
    Kind,
    TypeDefinitionNode,
    TypeNode,
    ValueNode,
} from 'graphql'

import { last, reduce } from '../lodash'
import {
    CustomScalarField,
    EnumField,
    ObjectField,
    ScalarField,
} from './field'
import { SdlField } from './field/interface'
import {
    BooleanValue,
    EnumValue,
    FloatValue,
    IntValue,
    ListValue,
    NullValue,
    ObjectValue,
    StringValue
} from './inputValue'
import { InputValue } from './inputValue/interface'
import { SdlDirective } from './interface'
import SdlEnumType from './namedType/enumType'
import { SdlNamedType } from './namedType/interface'
import SdlObjectType from './namedType/objectType'

const isSpecifiedScalar = ( type: string ): boolean => {
    if ( !type ) {
        return false
    }
    return (
        type === GraphQLString.name ||
        type === GraphQLInt.name ||
        type === GraphQLFloat.name ||
        type === GraphQLBoolean.name ||
        type === GraphQLID.name
    )
}

export const parseDirectiveInput = ( node: ValueNode ): InputValue => {
    switch ( node.kind ) {
    case Kind.INT:
        return new IntValue( { value: parseInt( node.value, 10 ) } )

    case Kind.FLOAT:
        return new FloatValue( { value: parseFloat( node.value ) } )

    case Kind.STRING:
        return new StringValue( { value: node.value } )

    case Kind.BOOLEAN:
        return new BooleanValue( { value: node.value } )

    case Kind.ENUM:
        return new EnumValue( { value: node.value } )

    case Kind.NULL:
        return new NullValue()

    case Kind.LIST:
        return new ListValue( {
            values: node.values.map( nestedNode => parseDirectiveInput( nestedNode ) )
        } )

    case Kind.OBJECT:
        return new ObjectValue( {
            fields: reduce( node.fields, ( result, field ) => {
                result[field.name.value] = parseDirectiveInput( field.value )
                return result
            }, {} )
        } )

        // all the scalars
    default:
        throw new Error( `not supported type in directive parsing: ${node.kind}` )
    }
}

export const parseDirectiveNode = ( node: DirectiveNode ): SdlDirective => {
    return {
        args: reduce( node.arguments, ( result, argNode ) => {
            result[argNode.name.value] = parseDirectiveInput( argNode.value )
            return result
        }, {} ),
    }
}

export const findTypeInDocumentAst = ( node: DocumentNode, name: string ): any => {
    const foundNode = node.definitions.find( ( defNode: TypeDefinitionNode ) => {
        return defNode.name.value === name
    } )
    return foundNode ? foundNode.kind : null
}

export const parseWrappedType = ( node: TypeNode, typeWrapped: string[] = [] ): {type: string; wrapped: string[]} => {
    if ( node.kind === Kind.NON_NULL_TYPE ) {
        return parseWrappedType( node.type, typeWrapped.concat( Kind.NON_NULL_TYPE ) )
    }

    if ( node.kind === Kind.LIST_TYPE ) {
        return parseWrappedType( node.type, typeWrapped.concat( Kind.LIST_TYPE ) )
    }

    return { type: node.name.value, wrapped: typeWrapped }
}

export const createSdlField = (
    documentNode: DocumentNode,
    node: FieldDefinitionNode,
    getSdlNamedType: ( name: string ) => SdlNamedType,
): SdlField => {
    const typeNode = node.type
    const { type, wrapped } = parseWrappedType( typeNode )
    // not dealing with nested list for now
    const nonNull = wrapped[0] === Kind.NON_NULL_TYPE
    const list = ( wrapped[0] === Kind.LIST_TYPE || wrapped[1] === Kind.LIST_TYPE )
    const itemNonNull = ( list && last( wrapped ) === Kind.NON_NULL_TYPE )

    // construct directives
    const directives = reduce( node.directives, ( result, directiveNode ) => {
        result[directiveNode.name.value] = parseDirectiveNode( directiveNode )
        return result
    }, {} )
    // field configs
    const fieldConfigs = { typename: type, nonNull, list, itemNonNull, directives }

    if ( isSpecifiedScalar( type ) ) {
        return new ScalarField( fieldConfigs )
    }

    // find its type
    const nodeType = findTypeInDocumentAst( documentNode, type )
    if ( !nodeType ) {
        throw new Error( `type of "${type}" not found in document` )
    }

    switch ( nodeType ) {
    case Kind.SCALAR_TYPE_DEFINITION:
        return new CustomScalarField( fieldConfigs )

    case Kind.ENUM_TYPE_DEFINITION:
        // eslint-disable-next-line no-case-declarations
        const enumField = new EnumField( fieldConfigs )
        enumField.setEnumType(
            () => getSdlNamedType( enumField.getTypeName() ) as SdlEnumType,
        )
        return enumField

    case Kind.OBJECT_TYPE_DEFINITION:
        // eslint-disable-next-line no-case-declarations
        const field = new ObjectField( fieldConfigs )
        field.setObjectType(
            () => getSdlNamedType( field.getTypeName() ) as SdlObjectType,
        )
        return field
    }
}
