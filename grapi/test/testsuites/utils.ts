import chai from 'chai'
import chaiHttp = require( 'chai-http' );
chai.use( chaiHttp )
import { ApolloServer } from 'apollo-server-koa'
import dotenv from 'dotenv'
import { GraphQLScalarType } from 'graphql'
import http from 'http'
import Koa from 'koa'
import { isArray, mapValues } from 'lodash'
import path from 'path'

import { MongodbDataSourceGroup } from '../../../grapi-mongodb/src/index'
import { DataSource, Grapi, Plugin } from '../../src'

export { MongodbDataSourceGroup }

export const createApp = ( { sdl, dataSources, scalars, plugins, }: {
    sdl: string;
    dataSources: Record<string, ( args: any ) => DataSource>;
    scalars?: Record<string, GraphQLScalarType>;
    plugins?: Plugin[];
} ) => {
    const grapi = new Grapi( { sdl, dataSources, scalars, plugins } )
    const server = new ApolloServer( grapi.createApolloConfig() )
    const app = new Koa()
    server.applyMiddleware( { app } )
    const httpServer = http.createServer( app.callback() )
    const requester = chai.request( httpServer ).keepOpen()

    const graphqlRequest = async ( query, variables ): Promise<any> => {
        const request = requester
            .post( server.graphqlPath )

        const res = await request.send( {
            operationName: null,
            query,
            variables,
        } )

        if ( res.body && res.body.errors ) {
            // tslint:disable-next-line:no-console
            // console.error(JSON.stringify(res.body.errors, null, 2));
            // return res.body.errors;
            throw new Error( JSON.stringify( res.body.errors, null, 2 ) )
        }

        return res.body.data
    }

    return {
        graphqlRequest,
        close: () => requester.close(),
    }
}

export const createGrapiApp = ( sdl: string, dataSources: Record<string, any>, plugins?: Plugin[], ): any => {
    const { graphqlRequest, close } = createApp( {
        sdl,
        dataSources,
        scalars: {},
        plugins
    } )
    return { graphqlRequest, close }
}

export const prepareConfig = (): any => {
    let mongoUri: string
    let serviceAccount: Record<string, any>

    dotenv.config( {
        path: path.resolve( process.cwd(), '.env.test' )
    } )

    if ( process.env.CI ) {
        mongoUri = process.env.TEST_MONGODB_URI
        serviceAccount = JSON.parse( process.env.TEST_SERVICE_ACCOUNT )
    } else {
        // local dev
        mongoUri = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017'
        serviceAccount = {}
    }

    return { mongoUri, serviceAccount }
}

export const wrapSetToArrayField = ( data: Record<string, any> ): any => {
    return mapValues( data, value => {
        if ( isArray( value ) ) {
            return { set: value }
        }

        return value
    } )
}
