import chai from 'chai'
import { readFileSync } from 'fs'
import { some } from 'lodash'
import path from 'path'
const expect = chai.expect

const userFields = `
  name
  hobbies
  phones
  friends
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

export const sdl = readFileSync( path.resolve( __dirname, '../fixtures/scalarListInput.graphql' ), { encoding: 'utf8' } )

export function testSuits() {

    it( 'List Scalar: should pass `gt`, `gte`, `lt`, `lte` and `size` filters', async ()  => {
        // gt filter
        const getUsers = `
        query ($where: UserWhereInput!) {
          users( where: $where) { ${userFields} }
        }`
        let getUsersVariables: any = { where: { phones:  { gt:50 } } }
        let res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        // console.log( JSON.stringify( res, null, 2 ) )
        expect( res.users ).with.lengthOf( 1 )
        expect( some( res.users, { name: 'Wout Beckers' } ) ).to.be.true
      
        // size filter
        getUsersVariables = { where: { hobbies:  { size:3 } } }  // get array with size == 3
        res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        // console.log( JSON.stringify( res, null, 2 ) )
        expect( res.users ).with.lengthOf( 2 )
        expect( some( res.users, { name: 'Wout Beckers' } ) ).to.be.false        
    } )

    it( 'Should pass "add" int, string and json list', async ()  => {
        const updateBenVariables = {
            where: { name: userName  },
            data: {
                phones: { add: [ 45, 50, 100 ] },
                hobbies: { add: [ 'Movies', 'Programming' ] },
                friends: { add: [ { name: 'Maria Doe' }  ] }
            }
        }
        const res = await ( this as any ).graphqlRequest( updateBen, updateBenVariables )
        expect( res.updateUser ).to.deep.include( {
            name: userName,
            phones: [ 1, 2, 3, 45, 50, 100 ],
            hobbies: [ 'Video Games', 'Guitar', 'Bicycle', 'Movies', 'Programming' ],
            friends: [ { name: 'Jhon Doe' }, { name: 'Maria Doe' } ]
        } )
    } )

    it( 'Should pass "remove" int, string and json list', async ()  => {
        const updateBenVariables = {
            where: { name: 'Wout Beckers'  },
            data: {
                phones: { remove: [ 1, 2, 3 ] },
                hobbies: { remove: [ 'Video Games', 'Guitar', 'Bicycle' ] },
                friends: { remove: [ { name: 'Jhon Doe' } ] }
            }
        }
        const res = await ( this as any ).graphqlRequest( updateBen, updateBenVariables )
        expect( res.updateUser ).to.deep.include( {
            name: 'Wout Beckers',
            phones: [ 45, 50, 100 ],
            hobbies: [ 'Movies', 'Programming' ],
            friends: [ { name: 'Maria Doe' } ]
        } )
    } )


}
