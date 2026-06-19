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

// now we are building the objects that we will be handing later on. and a clean way to build the said objects.
// once we have this, the next step - the scanning loop - the part where our code is scanned constantly in a loop to check whether the things fit in the tokens we described or not. and it will also be consitant broken down into tokens using the method we define now.

export type Token = {
  type: TokenType;
};

export const token = {
  leftParen(): Token {
    return { type: TokenType.LeftParen };
  },

  rightParen(): Token {
    return { type: TokenType.RightParen };
  },

  leftCurly(): Token {
    return { type: TokenType.LeftCurly };
  },

  rightCurly(): Token {
    return { type: TokenType.RightCurly };
  },

  dot(): Token {
    return { type: TokenType.Dot };
  },
  semicolon(): Token {
    return { type: TokenType.Semicolon };
  },
};

// tokenize function
// takes the source string returns an array of tokens
// Token[] retunrs type says explicitly "this hands back a list of token"
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let current: number = 0;

  while (current < input.length) {
    const char: string | undefined = input[current];

    switch (char) {
      case "(":
        tokens.push(token.leftParen());
        break;

      case ")":
        tokens.push(token.rightParen());
        break;

      case "{":
        tokens.push(token.leftCurly());
        break;

      case "}":
        tokens.push(token.rightCurly());
        break;

      case ".":
        tokens.push(token.dot());
        break;

      case ";":
        tokens.push(token.semicolon());
        break;

      default:
        throw new Error(`Unknown character: ${char}`);
    }

    current = current + 1;
  }

  return tokens;
}

console.log(tokenize("{}()"));
