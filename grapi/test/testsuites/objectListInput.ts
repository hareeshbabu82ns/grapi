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
                notes: { add: [ { language: 'TEL', text:'TEL Ben' } ] },
            }
        }
        const res = await ( this as any ).graphqlRequest( updateBen, updateBenVariables )
        expect( res.updateUser ).to.deep.include( {
            name: userName,
            notes: [ { language: 'ENG', text:'ENG Ben' }, { language: 'DEU', text:'DEU Ben' }, { language: 'TEL', text:'TEL Ben' } ],
        } )
    } )

    it( 'Should pass "remove" object list', async ()  => {
        const updateBenVariables = {
            where: { name: 'Wout Beckers'  },
            data: {
                notes: { remove: [ { language: 'ENG', text:'ENG Wout' } ] },
            }
        }
        const res = await ( this as any ).graphqlRequest( updateBen, updateBenVariables )
        expect( res.updateUser ).to.deep.include( {
            name: 'Wout Beckers',
            notes: [ { language: 'DEU', text:'DEU Wout' } ],
        } )
    } )

    it( 'Should pass `eq` and `neq` filters to object type fields', async ()  => {
        const getUsersMarriedEq = `
        query ($where: UserWhereInput!) {
          users( where: $where) { ${userFields} }
        }`
        const getUsersMarriedEqVariables = {
            where: { notes__text: 'ENG Ben' }
        }
        let res = await ( this as any ).graphqlRequest( getUsersMarriedEq, getUsersMarriedEqVariables )
        expect( res.users ).with.lengthOf( 1 )
        expect( res.users[0] ).to.deep.includes( { name: 'Ben Bohm' } )

        // neq filter
        const getUsersMarriedNeq = `
        query ($where: UserWhereInput!) {
          users( where: $where) { ${userFields} }
        }`
        const getUsersMarriedNeqVariables = {
            where: { notes__text_neq: 'ENG Ben' }
        }
        res = await ( this as any ).graphqlRequest( getUsersMarriedNeq, getUsersMarriedNeqVariables )
        expect( res.users ).with.lengthOf( 2 )
        expect( some( res.users, { name: 'Wout Beckers' } ) ).to.be.true
        expect( some( res.users, { name: 'Michela Battaglia' } ) ).to.be.true
    } )    
}
