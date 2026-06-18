/**
 * A token is a single meaningful chunk of source, with a type.
 * for eg, in function hello(){}, "function" itself will be a token as it has some meaning. 'f' wont be a token as standalone it has no meaning.
 * But ';' will be a token too as it does carry some meaning standalone.
 */

// What a tokenizer does is it chunks things of the same kind together.
// But for that, we must also define the "kinds" before we can start chunking them together.

// when we pass a string or code to a tokenizer, it creates token.
// and a token = {type (+ maybe a value of that type)}

// with enums we are saying that anything coming to the tokenizer is exactly on of these things and no other kind.
// Enum is a fixed set of constant values that belong together as one category.
export enum TokenType {
  LeftParen = "LeftParen",
  RightParen = "RightParen",
  LeftCurly = "LeftCurly",
  RightCurly = "RightCurly",
  Dot = "Dot",
  Semicolon = "Semicolon",
}

// up until this point we have only described the kinds of tokens, not what actual tokens will be. from now, we'll focus on defining what the actual token are.
