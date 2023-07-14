namespace Postgres;

using TypeSpec.Reflection;

extern dec entity(target: Model | Enum, name?: valueof string);

extern dec references(target: ModelProperty, element: Model);