---
title: "Dominando os Utility Types do TypeScript"
date: 2024-07-18
description: "Se você está navegando no universo TypeScript e ainda não explorou os poderosos Utility Types,..."
tags: ["typescript", "development", "career"]
slug: dominando-os-utility-types-do-typescript
---

Se você está navegando no universo TypeScript e ainda não explorou os poderosos Utility Types, prepare-se para se surpreender! Os Utility Types transformam seu código TypeScript, tornando-o mais limpo, seguro e eficiente. Vamos explorar esses tipos e ver como eles podem facilitar sua vida de desenvolvedor.

## O Básico: O que são Utility Types?

Os Utility Types são tipos genéricos fornecidos pelo TypeScript que permitem transformar outros tipos de maneira prática e útil. Eles ajudam a simplificar o código, garantindo que ele seja mais robusto e menos propenso a erros. Vamos mergulhar em alguns dos utility types mais comuns e ver exemplos práticos de como usá-los.

### 1. Partial<Type> 🧩

Imagine que você tem uma interface `User` e deseja criar uma função que atualize os dados do usuário, mas sem a necessidade de passar todas as propriedades. O `Partial` é a solução!

```typescript
interface User {
  id: number;
  name: string;
  age: number;
}

const updateUser = (user: Partial<User>) => {
  console.log(user); // Agora é possível passar apenas algumas propriedades
};

updateUser({ name: "Alice" }); // Válido
updateUser({ age: 30 });       // Válido
```

### 2. Required<Type> ✔️

Às vezes, você precisa garantir que todas as propriedades de um tipo sejam obrigatórias. É aqui que o `Required` entra em cena.

```typescript
interface User {
  id?: number;
  name?: string;
  age?: number;
}

const createUser = (user: Required<User>) => {
  // Agora todas as propriedades de User são obrigatórias
  console.log(user);
};

createUser({ id: 1, name: "Sibelius", age: 29 });
```

### 3. Readonly<Type> 🔒

Precisa garantir que as propriedades de um objeto não sejam modificadas? Use o `Readonly`.

```typescript
interface User {
  id: number;
  name: string;
}

const getUser = (user: Readonly<User>) => {
  console.log(user);
};

const user: Readonly<User> = { id: 1, name: "Yaya" };
user.id = 2; // Erro: Cannot assign to 'id' because it is a read-only property.
```

### 4. Pick<Type, Keys> 🎯

Quer criar um tipo com apenas algumas propriedades de outro tipo? O `Pick` é perfeito para isso.

```typescript
interface User {
  id: number;
  name: string;
  age: number;
}

type UserIdAndName = Pick<User, "id" | "name">;

const user: UserIdAndName = { id: 1, name: "Yaya" }; // Válido
```

### 5. Omit<Type, Keys> 🚫

Precisa excluir algumas propriedades de um tipo? O `Omit` é a ferramenta certa.

```typescript
interface User {
  id: number;
  name: string;
  age: number;
}

type UserWithoutAge = Omit<User, "age">;

const user: UserWithoutAge = { id: 1, name: "Yaya" }; // Válido
```

### 6. Record<Keys, Type> 📚

Quer criar um objeto onde cada chave tem um tipo específico? Use o `Record`.

```typescript
type Role = "admin" | "user" | "guest";

const roles: Record<Role, number> = {
  admin: 1,
  user: 2,
  guest: 3,
};
```

### 7. Exclude<Type, ExcludedUnion> 🔍

O `Exclude` é útil quando você precisa criar um tipo excluindo alguns membros de uma união.

```typescript
type T = "a" | "b" | "c";
type ExcludeB = Exclude<T, "b">; // "a" | "c"
```

### 8. Extract<Type, Union> 🕵️

O `Extract` permite criar um tipo extraindo membros de uma união.

```typescript
type T = "a" | "b" | "c";
type ExtractA = Extract<T, "a" | "b">; // "a" | "b"
```

### 9. NonNullable<Type> 🚫 null/undefined

Quer remover `null` e `undefined` de um tipo? Use o `NonNullable`.

```typescript
type T = string | number | null | undefined;
type NonNullableT = NonNullable<T>; 
```

## Colocando Tudo em Prática

Vamos ver um exemplo prático que utiliza vários desses utility types para construir uma aplicação robusta e segura.

```typescript
interface User {
  id: number;
  name: string;
  email?: string;
}

// Atualiza um usuário aceitando apenas algumas propriedades
const updateUser = (user: Partial<User>) => {
  // Código para atualizar o usuário
  console.log("User updated:", user);
};

// Função que cria um usuário garantindo que todas as propriedades estejam presentes
const createUser = (user: Required<User>) => {
  console.log("User created:", user);
};

// Exibe os dados do usuário, sem permitir modificações
const printUser = (user: Readonly<User>) => {
  console.log("User:", user);
  // user.id = 2; // Erro: Cannot assign to 'id' because it is a read-only property.
};

// Atualizando usuário com propriedades parciais
updateUser({ id: 1, email: "lincolixavier@zoho.com" });

// Criando um usuário com todas as propriedades obrigatórias
createUser({ id: 2, name: "Zidane", email: "zidane@zoho.com" });

// Exibindo dados do usuário, sem modificá-los
printUser({ id: 3, name: "Carlos" });
```

Neste exemplo, utilizamos `Partial`, `Required` e `Readonly` para diferentes funções que manipulam um objeto `User`. Cada função tem requisitos específicos para o tipo de objeto que aceita, garantindo flexibilidade e segurança.

## Dicas Práticas

1. **Combine Utility Types**: Não hesite em combinar utility types para criar tipos complexos que atendam às suas necessidades. Por exemplo, você pode combinar `Partial` com `Pick` para criar um tipo com propriedades opcionais específicas.

2. **Documente Seu Código**: Utility types podem tornar o código mais difícil de entender à primeira vista. Adicione comentários claros para explicar o que cada tipo está fazendo.

3. **Use Utility Types para Refatoração**: Ao refatorar seu código, os utility types podem ajudar a garantir que você não quebre nenhuma parte do sistema, especialmente quando você está lidando com objetos grandes e complexos.

4. **Experimente e Teste**: Não tenha medo de experimentar diferentes utility types e ver como eles podem simplificar seu código. Use testes para garantir que as transformações de tipos estão funcionando como esperado.

Os Utility Types do TypeScript são ferramentas poderosas que podem transformar a maneira como você escreve e mantém seu código. Ao usá-los de forma inteligente, você pode criar aplicações mais robustas, seguras e fáceis de manter. Então explore, experimente e aproveite a mágica dos Utility Types!

---

Gostou do artigo? Comente quais utility types você mais usa ou quer começar a usar!

**Que a Tipagem Estática esteja com você** 💪

Referência: [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/utility-types.html)

---
✨ Conheça a Comunidade Nomadz ✨
👉🏻 [Patreon](https://www.patreon.com/nomadz/membership)

Quer falar comigo? Tô por aqui:
- [Instagram](https://instagram.com/lincoli.xavier)
- [TikTok](https://www.tiktok.com/@lincoli.xavier)
- [Twitter](https://twitter.com/lincolixavier)
- [YouTube](https://youtube.com/@lincoli.xavier/)
- [Website](https://www.lincolixavier.com/)

---
