import Model from '../model'

export enum RelationType {
    uniOneToOne = 'UNI_ONE_TO_ONE',
    uniManyToOne = 'UNI_MANY_TO_ONE',
    uniOneToMany = 'UNI_ONE_TO_MANY',
    biOneToOne = 'BI_ONE_TO_ONE',
    biOneToMany = 'BI_ONE_TO_MANY',
    biManyToMany = 'BI_MANY_TO_MANY',
}

export enum RelationShip {
    OneToOne = 'RelationOneToOne',
    OneToMany = 'RelationOneToMany',
    ManyToMany = 'RelationManyToMany'
}

export interface ModelRelation {
    type: RelationType;
    name?: string;
    source: Model;
    sourceField: string;
    target: Model;
    // exists if bi-directional
    targetField?: string;
    // metadata on relation
    metadata?: Record<string, any>;
}
