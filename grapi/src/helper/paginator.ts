import { Pagination } from '..'
import { flow, slice, take, takeRight, takeRightWhile, takeWhile } from '../lodash'
import { first as _first, get, isEmpty, isNil, isUndefined, last as _last } from '../lodash'

export const paginate = ( rows: any[], pagination?: Pagination ):
{data: any[]; total: number; hasNextPage: boolean; hasPreviousPage: boolean} => {
    if ( isEmpty( pagination ) || isEmpty( rows ) ) {
        return {
            data: rows,
            total: rows.length,
            hasNextPage: false,
            hasPreviousPage: false,
        }
    }

    const transforms = []
    // numbered pagination
    if ( pagination.perPage && pagination.page ) {
        const skip = pagination.perPage * ( pagination.page - 1 )
        const limit = pagination.perPage
        if ( !isUndefined( skip ) && skip > 0 ) {
            transforms.push( slice( skip ) )
        }

        if ( !isUndefined( limit ) ) {
            transforms.push( take( limit ) )
        }

        const totalPages = Math.ceil( rows.length / pagination.perPage )
        return {
            data: flow( transforms )( rows ),
            total: rows.length,
            hasNextPage: totalPages > pagination.page,
            hasPreviousPage: pagination.page > 1,
        }
    }

    // cursor pagination
    const { last, first, before, after } = pagination

    if ( !isUndefined( before ) ) {
        transforms.push( takeWhile<any>( row => row.id !== before ) )
    }

    if ( !isUndefined( after ) ) {
        transforms.push( takeRightWhile<any>( row => row.id !== after ) )
    }

    if ( !isUndefined( first ) ) {
        transforms.push( take( first ) )
    }

    if ( !isUndefined( last ) ) {
        transforms.push( takeRight( last ) )
    }
    const data = flow( transforms )( rows )

    const firstRowId = get( _first( rows ), 'id' )
    const firstFilteredDataId = get( _first( data ), 'id' )
    const lastRowId = get( _last( rows ), 'id' )
    const lastFilteredDataId = get( _last( data ), 'id' )
    return {
        data,
        total: rows.length,
        hasNextPage: ( !isNil( lastRowId ) && !isNil( lastFilteredDataId ) && lastRowId !== lastFilteredDataId ),
        hasPreviousPage: ( !isNil( firstRowId ) && !isNil( firstFilteredDataId ) && firstRowId !== firstFilteredDataId ),
    }
}
