import chai from 'chai'
import { readFileSync } from 'fs'
import { some } from 'lodash'
import path from 'path'
const expect = chai.expect

const userFields = `
  name
  notes {
      language
      text
      score
  }
`

const userName = 'Ben Bohm'
const updateBen = `mutation (
    $where: UserWhereUniqueInput!
    $data: UserUpdateInput!
) {
    updateUser( 
        where: $where 
        data: $data 
    ) { ${userFields} }
}`

export const sdl = readFileSync( path.resolve( __dirname, '../fixtures/objectListInput.graphql' ), { encoding: 'utf8' } )

export function testSuits() {

    it( 'Should pass "add" object list', async ()  => {
        const updateBenVariables = {
            where: { name: userName  },
            data: {
                notes: { add: [ { language: 'TEL', text:'TEL Ben', score: 25 } ] },
            }
        }
        const res = await ( this as any ).graphqlRequest( updateBen, updateBenVariables )
        expect( res.updateUser ).to.deep.include( {
            name: userName,
            notes: [ 
                { language: 'ENG', text:'ENG Ben', score: 5 }, 
                { language: 'DEU', text:'DEU Ben', score: 15 },
                { language: 'TEL', text:'TEL Ben', score: 25 } ],
        } )
    } )

    it( 'Should pass "remove" object list', async ()  => {
        const updateBenVariables = {
            where: { name: 'Wout Beckers'  },
            data: {
                notes: { remove: [ { language: 'ENG', text:'ENG Wout', score: 5 } ] },
            }
        }
        const res = await ( this as any ).graphqlRequest( updateBen, updateBenVariables )
        expect( res.updateUser ).to.deep.include( {
            name: 'Wout Beckers',
            notes: [ { language: 'DEU', text:'DEU Wout', score: 30 } ],
        } )
    } )

    it( 'Should pass `eq` and `neq` filters to object type fields', async ()  => {
        const getUsersEq = `
        query ($where: UserWhereInput!) {
          users( where: $where) { ${userFields} }
        }`
        const getUsersEqVariables = {
            where: { notes: { text: 'ENG Ben' } }
        }
        let res = await ( this as any ).graphqlRequest( getUsersEq, getUsersEqVariables )
        expect( res.users ).with.lengthOf( 1 )
        expect( res.users[0] ).to.deep.includes( { name: 'Ben Bohm' } )

        // neq filter
        const getUsersNeq = `
        query ($where: UserWhereInput!) {
          users( where: $where) { ${userFields} }
        }`
        const getUsersNeqVariables = {
            where: { notes: { text_neq: 'ENG Ben' } }
        }
        res = await ( this as any ).graphqlRequest( getUsersNeq, getUsersNeqVariables )
        expect( res.users ).with.lengthOf( 2 )
        expect( some( res.users, { name: 'Wout Beckers' } ) ).to.be.true
        expect( some( res.users, { name: 'Michela Battaglia' } ) ).to.be.true

        // gte, lt filter
        const getUsersGt = `
        query ($where: UserWhereInput!) {
          users( where: $where) { ${userFields} }
        }`
        const getUsersGtVariables = {
            where: { notes: { score_gte: 30, score_lt: 35 } }
        }
        res = await ( this as any ).graphqlRequest( getUsersGt, getUsersGtVariables )
        expect( res.users ).with.lengthOf( 2 )
        expect( some( res.users, { name: 'Wout Beckers' } ) ).to.be.true
        expect( some( res.users, { name: 'Michela Battaglia' } ) ).to.be.false

        // elementMatch filter
        const getUsersEM = `
        query ($where: UserWhereInput!) {
          users( where: $where) { ${userFields} }
        }`
        const getUsersEMVariables = {
            where: { notes: { elementMatch: { score_lte: 10, language: 'ENG' } } }
        }
        res = await ( this as any ).graphqlRequest( getUsersEM, getUsersEMVariables )
        // console.log( JSON.stringify( res, null, 2 ) )
        expect( res.users ).with.lengthOf( 1 )
        expect( some( res.users, { name: 'Ben Bohm' } ) ).to.be.true
    } )    
}
