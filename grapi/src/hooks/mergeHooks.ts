import { IObjectTypeResolver } from 'graphql-tools'

import { forEach, mapValues, reduce } from '../lodash'
import compose from './compose'
import { CreateContext, DeleteContext, Hook, UpdateContext } from './interface'

interface ReducedHook {
    wrapCreate?: Array<( context: CreateContext, createOperation: () => Promise<any> ) => Promise<any>>;

    // update
    wrapUpdate?: Array<( context: UpdateContext, updateOperation: () => Promise<any> ) => Promise<any>>;

    // delete
    wrapDelete?: Array<( context: DeleteContext, destroyOperation: () => Promise<any> ) => Promise<any>>;

    // query
    resolveFields?: IObjectTypeResolver;
}

const createEmptyHook = (): ReducedHook => ( {
    wrapCreate: [],
    wrapUpdate: [],
    wrapDelete: [],
    resolveFields: {},
} )

export default ( hooks: Array<Record<string, Hook>> ): Record<string, Hook> => {
    const reducedHookMap: Record<string, ReducedHook> = reduce( hooks, ( result: ReducedHook, hookMap ) => {
        forEach( hookMap, ( hook, modelName ) => {
            if ( !result[modelName] ) {
                result[modelName] = createEmptyHook()
            }

            // push individual crud hook
            forEach( hook, ( method, methodName ) => {
                if ( methodName === 'resolveFields' ) {
                    result[modelName].resolveFields = {
                        ...result[modelName].resolveFields,
                        ...method,
                    }
                } else {
                    result[modelName][methodName].push( method )
                }
            } )
        } )
        return result
    }, {} ) as Record<string, ReducedHook>

    // combine functions
    // todo: optimize the flow, maybe execute in parallel
    return mapValues( reducedHookMap, hookMap => {
        return mapValues( hookMap, ( combinedHooks, key ) => {
            if ( key === 'resolveFields' ) {
                return combinedHooks
            } else {
                return compose( combinedHooks as any[] ) as any
            }
        } )
    } )
}
