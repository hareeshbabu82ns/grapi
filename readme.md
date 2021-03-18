<div align="center">

<a href="https://github.com/scalars/grapi"><img src="https://raw.githubusercontent.com/scalars/grapi/master/resources/logo-grapi.svg" width="50%"></a>

</div>

<br/>

> Businesses usually involving a broad spectrum of applications, that aren't integrated and requiring human intervention at almost every step of the process, this lack of integration and automation pretend to be solved trought an autogenerated GraphQL API Layer.
> **Grapi make GraphQL API integration simple and easy.**

## Installation
``` shell
yarn add @scalars/grapi
```
Or
``` shell
npm install @scalars/grapi
```

## Features
### Build GraphQL API with GraphQL SDL

SDL or Schema Definition Language is part of GraphQL Language, to define data and resolvers for the GraphQL API.

```graphql
# File schema.graphql
enum Gender {
    NO_GENDER,
    FEMALE,
    MALE
}
type Actor @Model( dataSource: "datasource", key: "Actor" ) {
    id: ID ! @unique
    name: String !
    gender: Gender
}
```

**Grapi** read SDL types and autogen resolvers for query and mutations on every model defined in SDL schema.

```typescript
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { MongodbDataSourceGroup } from '@scalars/grapi-mongodb'
import { Grapi } from '@scalars/grapi'
import { ApolloServer } from 'apollo-server'

const getDataSource = async () => {
    const datasource = new MongodbDataSourceGroup(
        process.env.MONGO_URI,
        process.env.DATA_BASE_NAME
    )
    await datasource.initialize()
    return datasource
}

const startGraphQLServer = async () => {
    const datasource = await getDataSource()
    const sdl = readFileSync( resolve( __dirname, 'schema.graphql' ) ).toString()
    const grapi = new Grapi( {
        sdl,
        dataSources: {
            datasource: ( args ) => datasource.getDataSource( args.key ),
        }
    } )
    const server = new ApolloServer( grapi.createApolloConfig() )
    server.listen().then( ( { url } ) => {
        console.info( `GraphQL Server On: ${ url }` )
        console.info( `Go To Browser And See PlayGround` )
    } )
}

startGraphQLServer()
```

### Auto-Generated GraphQL Schema

Main characteristic of Grapi is autogen a GraphQL API with types defined in SDL, the previous schema create the next resolvers.

#### You can see the GraphQL server in action with
[ GraphQL PlayGround ](https://www.electronjs.org/apps/graphql-playground)

[ Insomnia ](https://insomnia.rest/download)

[ Graphiql ](https://github.com/graphql/graphiql)

<br/>

#### Singular
```graphql
# File schema.graphql
type Query {
    actor( where: ActorWhereUniqueInput ): Actor!
}
```
#### Plural
```graphql
# File schema.graphql
type Query {
    actors( where: ActorWhereInput ): [ Actor ! ] !
}
```

#### Create
```graphql
# File schema.graphql
type Mutation {
    createActor( data: ActorCreateInput ): Actor !
}
```

#### Update
```graphql
# File schema.graphql
type Mutation {
    updateActor( where: ActorWhereUniqueInput data: ActorUpdateInput ): Actor !
}
```
#### Delete
```graphql
# File schema.graphql
type Mutation {
    deleteActor( where: ActorWhereUniqueInput ): Actor !
}
```

These resolvers serve a schema in a GraphQL Server. Admit recover and save data from datasource provided by Mongo DataSource or your custom data source.


### RelationShip Made Easy

#### One To One Unidirectional
```graphql
# File schema.graphql
type ActorToAddress implements Relation @config( 
    name: "ActorToAddress"
    foreignKey: { key: "city_id", side: Actor } 
)

type Actor @Model( dataSource: "datasource", key: "Actor" ) {
    id: ID ! @unique
    name: String !
    address: Address @relation( with: ActorToAddress )
}

type Address @Model( dataSource: "datasource", key: "Address" ) {
    id: ID ! @unique
    street: String !
    location: Json
}
```

#### One To One Bidirectional
```graphql
# File schema.graphql
type ActorToAddress implements Relation @config( 
    name: "ActorToAddress"
    foreignKey: { key: "city_id", side: Actor } 
)

type Actor @Model( dataSource: "datasource", key: "Actor" ) {
    id: ID ! @unique
    name: String !
    address: Address @relation( with: ActorToAddress )
}

type Address @Model( dataSource: "datasource", key: "Address" ) {
    id: ID ! @unique
    street: String !
    location: Json
    actor: Actor @relation( with: ActorToAddress )
}
```

#### One To Many Bidirectional
```graphql
# File schema.graphql
type VehiclesFromActor implements Relation @config( 
    name: "VehiclesFromActor"
    foreignKey: { key: "owner_car_id" } 
)

type Actor @Model( dataSource: "datasource", key: "Actor" ) {
    id: ID ! @unique
    name: String !
    vehicles: [ Vehicle ! ] ! @relation( with: VehiclesFromActor )
}

type Vehicle @Model( dataSource: "datasource", key: "Vehicle" ) {
    id: ID ! @unique
    trademark: String !
    model: String
    name: String
    owner: Actor @relation( with: VehiclesFromActor )
}
```

#### Many To Many Bidirectional
```graphql
# File schema.graphql
type MoviesFromActorManyToMany implements Relation @config( name: "MoviesFromActorManyToMany" )

type Actor @Model( dataSource: "datasource", key: "Actor" ) {
    id: ID ! @unique
    name: String !
    movies: [ Movie! ] ! @relation( with: MoviesFromActorManyToMany )
}

type Movie @Model( dataSource: "datasource", key: "Movie" ) {
    id: ID ! @unique
    title: String !
    actors: [ Actor ! ] ! @relation( with: MoviesFromActorManyToMany )
}
```

## Supported data-sources

<div>
    <a href="https://github.com/scalars/grapi/tree/main/grapi-mongodb">
        Grapi Mongodb
    </a>
</div>

## Inspired By

<div>

<a href="https://github.com/Canner/gqlify">
    <img 
        src="https://raw.githubusercontent.com/Canner/gqlify/master/resources/logo-pink.svg"
        width="10%">
</a>

</div>

## License

Apache-2.0

![footer banner](https://madrov.com/favicon.ico)


Madrov Team
