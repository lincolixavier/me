---
title: "Mastering TypeScript's utility types"
date: 2024-07-18
description: "Partial, Required, Readonly, Pick, Omit, Record and friends: what each one does and when to reach for it."
tags: ["typescript", "development", "career"]
---

If you are working in TypeScript and have not explored the utility types yet, get ready. They transform your code, making it cleaner, safer and more efficient. Let's go through them and see how they make life easier.

## The basics: what are utility types?

Utility types are generic types provided by TypeScript that let you transform other types in practical, useful ways. They simplify code and make it more robust and less error-prone. Here are the most common ones, with examples.

### 1. `Partial<Type>`

Say you have a `User` interface and want a function that updates user data without having to pass every property. `Partial` is the answer.

```typescript
interface User {
  id: number;
  name: string;
  age: number;
}

const updateUser = (user: Partial<User>) => {
  console.log(user); // Now you can pass only some of the properties
};

updateUser({ name: "Alice" }); // Valid
updateUser({ age: 30 });       // Valid
```

### 2. `Required<Type>`

Sometimes you need to guarantee that every property of a type is present. That is where `Required` comes in.

```typescript
interface User {
  id?: number;
  name?: string;
  age?: number;
}

const createUser = (user: Required<User>) => {
  // Every property of User is now mandatory
  console.log(user);
};

createUser({ id: 1, name: "Sibelius", age: 29 });
```

### 3. `Readonly<Type>`

Need to guarantee that an object's properties are not modified? Use `Readonly`.

```typescript
interface User {
  id: number;
  name: string;
}

const getUser = (user: Readonly<User>) => {
  console.log(user);
};

const user: Readonly<User> = { id: 1, name: "Yaya" };
user.id = 2; // Error: Cannot assign to 'id' because it is a read-only property.
```

### 4. `Pick<Type, Keys>`

Want a type with only some properties of another type? `Pick` is perfect for that.

```typescript
interface User {
  id: number;
  name: string;
  age: number;
}

type UserIdAndName = Pick<User, "id" | "name">;

const user: UserIdAndName = { id: 1, name: "Yaya" }; // Valid
```

### 5. `Omit<Type, Keys>`

Need to drop some properties from a type? `Omit` is the right tool.

```typescript
interface User {
  id: number;
  name: string;
  age: number;
}

type UserWithoutAge = Omit<User, "age">;

const user: UserWithoutAge = { id: 1, name: "Yaya" }; // Valid
```

### 6. `Record<Keys, Type>`

Want an object where each key has a specific type? Use `Record`.

```typescript
type Role = "admin" | "user" | "guest";

const roles: Record<Role, number> = {
  admin: 1,
  user: 2,
  guest: 3,
};
```

### 7. `Exclude<Type, ExcludedUnion>`

`Exclude` is useful when you need a type built by removing members from a union.

```typescript
type T = "a" | "b" | "c";
type ExcludeB = Exclude<T, "b">; // "a" | "c"
```

### 8. `Extract<Type, Union>`

`Extract` builds a type by pulling members out of a union.

```typescript
type T = "a" | "b" | "c";
type ExtractA = Extract<T, "a" | "b">; // "a" | "b"
```

### 9. `NonNullable<Type>`

Want to strip `null` and `undefined` from a type? Use `NonNullable`.

```typescript
type T = string | number | null | undefined;
type NonNullableT = NonNullable<T>;
```

## Putting it together

Here is a practical example using several of these to build something robust and safe.

```typescript
interface User {
  id: number;
  name: string;
  email?: string;
}

// Updates a user, accepting only some properties
const updateUser = (user: Partial<User>) => {
  console.log("User updated:", user);
};

// Creates a user, guaranteeing every property is present
const createUser = (user: Required<User>) => {
  console.log("User created:", user);
};

// Prints the user data without allowing modification
const printUser = (user: Readonly<User>) => {
  console.log("User:", user);
  // user.id = 2; // Error: Cannot assign to 'id' because it is a read-only property.
};

updateUser({ id: 1, email: "hi@example.com" });
createUser({ id: 2, name: "Zidane", email: "zidane@example.com" });
printUser({ id: 3, name: "Carlos" });
```

Each function has specific requirements for the object it accepts, which gives you both flexibility and safety.

## Practical tips

1. **Combine them.** Do not hesitate to compose utility types to build exactly what you need. You can combine `Partial` with `Pick` to get a type with specific optional properties.

2. **Document your code.** Utility types can make code harder to read at a glance. Add clear comments explaining what each type is doing.

3. **Use them when refactoring.** They help ensure you do not break part of the system, especially when dealing with large, complex objects.

4. **Experiment and test.** Try different utility types and see how they simplify your code. Use tests to confirm the type transformations behave as expected.

TypeScript's utility types are powerful tools that can change how you write and maintain code. Used well, they let you build applications that are more robust, safer and easier to maintain.

Reference: [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/utility-types.html)

---

[Nomadz community](https://www.patreon.com/nomadz/membership)
