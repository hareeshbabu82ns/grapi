import chai from 'chai'
import chaiSubset from 'chai-subset'
// import faker from 'faker';
import { readFileSync } from 'fs'
import path from 'path'
// import { wrapSetToArrayField } from './utils';
chai.use( chaiSubset )
const expect = chai.expect

const userFields = `
  name
  age
  married
`

export const sdl = readFileSync( path.resolve( __dirname, '../fixtures/schemaExtend.graphql' ), { encoding: 'utf8' } )

export function testSuits() {

    it( 'schemaExtend - User Enity', async () => {
        const getUsersMarriedEq = `
            query ($where: UserWhereInput!) {
              users( where: $where) { ${userFields} }
            }`
        const getUsersMarriedEqVariables = {
            where: { married: false }
        }
        const res = await ( this as any ).graphqlRequest( getUsersMarriedEq, getUsersMarriedEqVariables )
        expect( res.users ).with.lengthOf( 1 )
        expect( res.users[0] ).to.deep.includes( { name: 'Ben Bohm_chg' } )

    } )

    it( 'schemaExtend - Custom at Query', async () => {
        const query = `
            query {
              fieldTest
            }`
        const res = await ( this as any ).graphqlRequest( query )
        expect( res.fieldTest ).equals( 'sample value' )

    } )

}
