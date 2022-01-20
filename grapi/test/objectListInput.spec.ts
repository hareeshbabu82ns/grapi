import chai from 'chai'
import chaiHttp = require( 'chai-http' );
chai.use( chaiHttp )

import { sdl, testSuits } from './testsuites/objectListInput'
import { createGrapiApp, MongodbDataSourceGroup, prepareConfig } from './testsuites/utils'

const { mongoUri } = prepareConfig()
const DB_NAME = 'grapi'

const data = [
    {
        'name': 'Ben Bohm',
        notes: { set: [ { language: 'ENG', text:'ENG Ben', score: 5 }, { language: 'DEU', text:'DEU Ben', score: 15 } ] },
    },
    {
        'name': 'Wout Beckers',
        notes: { set: [ { language: 'ENG', text:'ENG Wout', score: 5 }, { language: 'DEU', text:'DEU Wout', score: 30 } ] },
    },
    {
        'name': 'Michela Battaglia',
        notes: { set: [ { language: 'ENG', text:'ENG Michela', score: 60 }, { language: 'DEU', text:'DEU Michela', score: 35 } ] },
    }
]

describe( 'Tests on fixtures/objectListInput.graphql mongodatasource', function() {
    this.timeout( 20000 )

    before( async () => {
        const mongodbDataSourceGroup = new MongodbDataSourceGroup( mongoUri, DB_NAME )
        await mongodbDataSourceGroup.initialize()
        const { graphqlRequest, close } = createGrapiApp( sdl, {
            memory: args => mongodbDataSourceGroup.getDataSource( args.key ),
        } )
        const query: string = `mutation ( $data: UserCreateInput! ) {
            createUser(
                data: $data
            ) { id }
        }`
        await graphqlRequest( query, { data: data[0] } )
        await graphqlRequest( query, { data: data[1] } )
        await graphqlRequest( query, { data: data[2] } );
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
