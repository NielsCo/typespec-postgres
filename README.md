# Introduction 
This unofficial Library for [TypeSpec](https://github.com/microsoft/typespec) makes it possible to emit the models defined in TypeSpec to PostgreSQL.<br>
It does this by adding new decorators to the TypeSpec language.<br><br>
In order to define actual schema there had to be ***limitations*** *set to the models and enums that are used in the schema*.
The limitations are set by the decorators and are described in the section [references](#references). <br>
The library is designed to aid in the initial creation of tables and enums, but the finer points of database design and administration will still require manual intervention.<br>
While the library is only a proof of concept that was developed as part of a thesis project, it produces valid schema and has a lot of tests to ensure that it does so.<br><br>
As TypeSpec itself is early in its development it regularly does have breaking changes between versions. This library currently supports the **TypeSpec Version 0.45.2**.

# Getting Started
You can skip the first 4 steps if you already have a TypeSpec-Project up and running
1.	### Install [Node.js 16 LTS or newer](https://nodejs.org/en/download) and ensure you are able to run the npm command in a command prompt:
    ```bash
        npm --version
    ```
2.	### Install TypeSpec compiler and libraries:
    ```bash
        npm install -g @typespec/compiler
    ```
3. ### Initialize a new TypeSpec project:
    ```bash
        tsp init
    ```    

4. ### (Optional) Install the TypeSpec extension for your editor of choice: <br>
    The extension will give you syntax highlighting and intellisense for the TypeSpec language including this library.
   - [Instructions for Visual Studio](https://github.com/microsoft/typespec#installing-visual-studio-extension)
   - [Instructions for Visual Studio Code](https://github.com/microsoft/typespec#installing-vs-code-extension)

5. ### Add the typespec-postgres library to your project:
    ```bash
        npm install typespec-postgres
    ```

6. ### Edit your tspconfig.yaml file to add the emitter:
    ```yaml
    emit:
    - '@typespec/openapi3'
    - 'typespec-postgres'
    # for more options see below
    ```
7. ### Import the library in your tsp file, use the Postgres namespace and mark the models and enums you want in your schema with the @entity decorator:
    ```typespec
    # other imports
    import "typespec-postgres";
    # other namespaces
    using Postgres;

    @entity()
    model Test {
        @key myId: numeric
    }
    ```

8. ### Run the compiler:
    ```bash
        tsp compile .
    ```
    The output will be in tsp-output/typespec-postgres/schema.sql


# Basic usage example
```typespec
import "@typespec/http";
import "typespec-postgres";

using TypeSpec.Http;
using Postgres;

@service({
  title: "Widget Service",
  version: "1.0.0",
})
namespace DemoService;

@entity
model Widget {
  @visibility("read", "update")
  @path
  @key
  id: string;

  weight: int32;
  color: "red" | "blue";
}

@error
model Error {
  code: int32;
  message: string;
}

@route("/widgets")
@tag("Widgets")
interface Widgets {
  @get list(): Widget[] | Error;
  @get read(@path id: string): Widget | Error;
  @post create(...Widget): Widget | Error;
  @patch update(...Widget): Widget | Error;
  @delete delete(@path id: string): void | Error;
  @route("{id}/analyze") @post analyze(@path id: string): string | Error;
}
```
Will emit the following schema:
```sql
CREATE SCHEMA DemoService;

CREATE TYPE DemoService.WidgetColorEnum AS ENUM ('red', 'blue');

CREATE TABLE DemoService.Widget (
    id TEXT PRIMARY KEY,
    weight INTEGER NOT NULL,
    color DemoService.WidgetColorEnum NOT NULL
);
```


# Entity Decorator

```@entity(name?: string)``` <br>

This decorator marks a model or an enum as an entity that should be emitted to the db-schema.<br>
The name parameter is optional and will default to the name of the model or enum. If it is set it will *override* the name of the model or enum in the emitted schema. <br>
All models and enums that are used by other entities will automatically be emitted as well.

If you want to emit all models and enums you can use the [emitter settings](#emitter-settings) but this is not recommended!

# References

References are only possible if the referenced entity has a primary **key**. <br>
Currently only singular primary keys are supported. <br> That means that a model can only have **one property that is marked as a key**. <br>

## Manual References
``` @references(entity: Model)  ``` <br>
This decorator is set to manually set the reference to another entity. This adds a foreign key constraint to the column.
The decorator always uses the primary key of the referenced entity and does currently not allow to set a different column.

###Example:
```typespec
# imports and using statements

model Test {
    @references(AnotherTest) anotherTest: numeric, 
    @key myId: numeric
}

model AnotherTest {
    @key myId: numeric
}

@entity
model ReferenceBoth {
    @references(AnotherTest) anotherTest: numeric,
    @references(Test) test: numeric
}
```
this will emit the following schema:
```sql
CREATE TABLE AnotherTest (myId NUMERIC PRIMARY KEY);

CREATE TABLE Test (
    anotherTest NUMERIC NOT NULL REFERENCES AnotherTest,
    myId NUMERIC PRIMARY KEY
);

CREATE TABLE ReferenceBoth (
    anotherTest NUMERIC NOT NULL REFERENCES AnotherTest,
    test NUMERIC NOT NULL REFERENCES Test
);
```

## Automatic References
If a model has a property that is a model itself, the property will automatically be set as a reference to the other model.
Example:
```typespec
# imports and using statements

@entity
model Test {
    anotherTest: AnotherTest
}
@entity
model AnotherTest {
    @key myId: numeric
}
```
Will emit the following schema:
```sql
CREATE TABLE AnotherTest (myId NUMERIC PRIMARY KEY);
CREATE TABLE Test (
    anotherTest NUMERIC NOT NULL REFERENCES AnotherTest
);
```
# Namespaces and Schema
As you can't nest schemas in PostgreSQL, the library will concat the namespace with filler characters to create a unique schema name. <br>
The filler characters are currently "_". <br>

```typespec
namespace this.can.be.very.nested.thing {
    @entity("Foo") model Nested {
        myId: string
    };
}
```
will emit 
```sql 
CREATE SCHEMA this_can_be_very_nested_thing; 
CREATE TABLE this_can_be_very_nested_thing.Foo (myId TEXT NOT NULL);
```
Only namespaces **with entities** will be emitted as schemas. <br>

# Limitations
## n:m relationships
n:m relationships can not be automatically resolved by the current implementation and will have to be manually resolved.<br>
n:m relationships are arrays of other models.

Example for unsupported n:m relationship:
```typespec
@entity()
model N {
  @key id: numeric;
}

@entity()
model M {
    users: N[]
}
```

## visibility will be ignored
The current code will use the Visibility.Read for all emitted schema.

## Database-Specific Features: 
The extension does not support the creation or manipulation of database-specific constructs such as indexes, views, stored procedures, or triggers. It is focused solely on the creation of tables, enums and schema.

## Database Users and Privileges: 
The extension does not handle the creation of database users or the assignment of privileges on tables and schemas.

## Union-Types
The only union-types that are supported are union-types where all values are of the type string. These will be emitted as enums. <br>

## Number type enums
Are currently not supported.

## Anonymous types
In order to persist types in postgres they need to be named. The library therefore tries to give all anonymous types a name. <br>
See the [basic usage example](#basic-usage-example) for an example of how this works. Here the anonymous union type is named "WidgetColorEnum". <br>
Some union-types can not be resolved. 

# emitter-settings

Emitter settings can be set in the tspconfig.yaml file. <br>

    ```yaml
    output-dir:
        '{project-root}/tsp-output'
    emit:
    - '@typespec/openapi3'
    - 'typespec-postgres'
    options:
        typespec-postgres:
            'emit-non-entity-types': false
            'save-mode': true
            'line-ending': 'lf' # or 'crlf'
            'file-type': 'sql' # only supports sql currently
    ```
## emit-non-entity-types
if set to true this will emit all models and enums that are not marked as entities as well. <br>
This is not set to default and not recommended as there are probably a lot of models and enums that are not needed in the schema as most APIs will have more DTOs than actual tables. Furthermore entities set restrictions on the models that are defined as entities. <br>
See [limitations](#limitations) and [References](#References) for more information.

## save-mode
turning on save-mode will try to create save emitted schema that can be run multiple times without errors. <br>
They use if exists statements to check if the table already exists and will only create the table if it does not exist yet. <br>
Same goes for adding columns to a table. <br>
This does not work for enums yet! So be careful when using save-mode with enums.

# Methodology
This repository allows you to define both the API and the database schema within the same single source of truth. <br>
It therefore combines API-First Design with Database-First Design to a new methodology I call **Database-Aware API-First Design. (DBA API-First Design)**

# Build and Test
1. Download the dependencies by running
```bash
    npm i
```
2. Build the TypeSpec by running 
```bash
    npm run build
```

3. To test run:
```bash
    npm run test
```

# Contribute

Thank you for considering contributing to this project! <br>
I'd be very happy about issues and pull requests.

Most of the tests are using this [formatter](https://marketplace.visualstudio.com/items?itemName=adpyke.vscode-sql-formatter) so the formatting of the sql to test against is unified. <br>

# Further reading

For more info read [the original TypeSpec Git](https://github.com/microsoft/typespec) <br>
Or go directly to the [documentation](https://microsoft.github.io/typespec/)

# Acknowledgements
The code for this project is based on the [TypeSpec OpenAPI3 emitter](https://github.com/microsoft/typespec/tree/main/packages/openapi3) which served as a foundation for learning how to write an emitter. <br>
This project is part of my bachelor thesis project and I'd like to thank [Objektkultur Software GmbH](https://objektkultur.de/), the company I did my thesis at, for allowing me to release this project as open source. <br>

# License 
For the license see [LICENSE](LICENSE)

## Package

| Name             | Latest |
| ---------------- | ------ |
| typespec-postgres  | [![](https://img.shields.io/npm/v/typespec-postgres)](https://www.npmjs.com/package/typespec-postgres) |
