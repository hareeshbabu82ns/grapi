import chai from 'chai'
import chaiHttp = require( 'chai-http' )
chai.use( chaiHttp )
import { MongoClient } from 'mongodb'

import { Context, ListReadable, MapReadable, Model, Plugin } from '../src'
import { sdl, testSuits } from './testsuites/schemaExtend'
import { createGrapiApp, MongodbDataSourceGroup, prepareConfig } from './testsuites/utils'

const { mongoUri } = prepareConfig()
const DB_NAME = 'grapi'
const COLLECTION_NAME = 'users_extend'

const data = [
    {
        'name': 'Ben Bohm',
        'age': 23,
        'married': false,
    },
    {
        'name': 'Wout Beckers',
        'age': 67,
        'married': true,
    },
    {
        'name': 'Michela Battaglia',
        'age': 43,
        'married': true,
    }
]

export default class TestQueryPlugin implements Plugin {

    // setPlugins( plugins: Plugin[] ): void {
    //     console.log( 'TestQuery Plugin - setPlugins' )
    // }

    visitModel( model: Model, context: Context ): void {
        const { root } = context
        // console.log( 'TestQuery Plugin - visitModel - ', model.getName() )
        if ( model.getName() === 'users' ) {
            root.addQuery( `fieldTest: String` )
        }
    }

    public resolveInQuery( {
        model,
        dataSource,
    }: {
        model: Model;
        dataSource: ListReadable & MapReadable;
    } ): any {
        // console.log( 'TestQuery Plugin - resolveInQuery - ', model.getName() )
        if ( model.getName() === 'users' ) {
            return {
                fieldTest: async ( root: any, args: any, context: any ): Promise<any> => {
                    // console.log( 'TestQuery Plugin - resolveInQuery - resolver' )
                    // console.log( root, args, context )
                    return 'sample value'
                },
            }
        }
    }

    resolveInRoot( {
        model,
        dataSource,
    }: {
        model: Model;
        dataSource: ListReadable & MapReadable;
    } ): any {
        // console.log( 'TestQuery Plugin - resolveInRoot - ', model.getName() )
        if ( model.getName() === 'users' ) {
            return {
                User: {
                    name: async ( root: any, args: any, context: any ): Promise<any> => {
                        // console.log( 'TestQuery Plugin - resolveInRoot - resolver' )
                        // console.log( root, args, context )
                        return root?.name as string + '_chg'
                    },
                }
            }
        }
    }

    extendTypes( model: Model ): any {
        if ( model.getName() === 'Test' ) {
            // console.log( 'TestQuery Plugin - extendTypes - ', model.getName() )
            // return {
            //   'Query.tests': 'Query.customTests',
            // }
        }
    }

}

const importData = async () => {
    const client = await MongoClient.connect( mongoUri, { useUnifiedTopology: true } )
    const db = await client.db( DB_NAME )
    const collection = await db.collection( COLLECTION_NAME )
    await collection.insertMany( data )
}

describe( 'Tests on fixtures/schemaExtend.graphql with MongoDB Data Source', function() {
    this.timeout( 20000 )

    before( async () => {
        const mongodbDataSourceGroup = new MongodbDataSourceGroup( mongoUri, DB_NAME )
        await mongodbDataSourceGroup.initialize()

        await importData()

        const { graphqlRequest, close } = createGrapiApp( sdl, {
            memory: args => mongodbDataSourceGroup.getDataSource( args.key ),
        }, [
            new TestQueryPlugin(),
        ] );
        ( this as any ).graphqlRequest = graphqlRequest;
        ( this as any ).close = close;
        ( this as any ).mongodb = ( mongodbDataSourceGroup as any ).db
    } )

    after( async () => {
        const listCollectionsQuery = await ( this as any ).mongodb.listCollections()
        const collections = await listCollectionsQuery.toArray()
        await Promise.all( collections.map( async collection => {
            await ( this as any ).mongodb.collection( collection.name ).deleteMany( {} )
        } ) )

        await ( this as any ).close()
    } )

    testSuits.call( this )
} )
