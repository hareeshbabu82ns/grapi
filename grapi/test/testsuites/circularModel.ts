import chai from 'chai'
import faker from 'faker'
import { readFileSync } from 'fs'
import path from 'path'

const expect = chai.expect

const userFields = `
  id
  username
`

const userWithFriendsFields = `
  id
  username
  friends {
    ${userFields}
  }
`

export const sdl = readFileSync( path.resolve( __dirname, '../fixtures/circularModel.graphql' ), { encoding: 'utf8' } )

export function testSuits() {
    it( 'should create user with bi-*-to-* friends', async () => {
        const createUserQuery = `
          mutation ($data: UserCreateInput!) {
            createUser (data: $data) {${userWithFriendsFields}}
          }
        `
        const createUserVariables = {
            data: {
                username: faker.internet.userName(),
                friends:{
                    create:[
                        {
                            username: faker.internet.userName(),
                        }
                    ]
                }
            },
        }
        const { createUser } = await ( this as any ).graphqlRequest( createUserQuery, createUserVariables )

        expect( createUser ).to.have.property( 'id' )
        expect( createUser.username ).to.be.eql( createUserVariables.data.username )
        // tslint:disable-next-line:no-unused-expression
        expect( createUser.friends ).to.be.an( 'array' ).that.is.not.empty
    } )

    it( 'should create connected Friend with bi-*-to-*', async () => {
        // create user with friends
        const createUserVariables = {
            data: {
                username: faker.internet.userName(),
                friends:{
                    create:[
                        {
                            username: faker.internet.userName(),
                        },
                        {
                            username: faker.internet.userName(),
                        }
                    ]
                }
            },
        }
        const createUserQuery = `
          mutation ($data: UserCreateInput!) {
            createUser (data: $data) {${userFields}}
          }
        `
        const { createUser } = await ( this as any ).graphqlRequest( createUserQuery, createUserVariables )
        expect( createUser ).to.have.property( 'id' )

        const userFriendsQuery = `
          query ($userName: String!, $data: UserWhereInput!) {
            users (where: { username: $userName }) { id username friends(where: $data){ id username }}
          }
        `
        const userFriendVariables = {
            userName: createUserVariables.data.username,
            data:{
                username: createUserVariables.data.friends.create[0].username,
            }
        }

        const { users } = await ( this as any ).graphqlRequest( userFriendsQuery, userFriendVariables )
        // console.log( JSON.stringify( users, null, 2 ) )
        expect( users ).to.be.an( 'array' ).that.is.not.empty
        expect( users[0].friends ).to.be.an( 'array' ).is.of.length( 1 )

    } )
}
