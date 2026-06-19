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
  Identifier = "Identifier",
}

// up until this point we have only described the kinds of tokens, not what actual tokens will be. from now, we'll focus on defining what the actual token are.

// now we are building the objects that we will be handing later on. and a clean way to build the said objects.
// once we have this, the next step - the scanning loop - the part where our code is scanned constantly in a loop to check whether the things fit in the tokens we described or not. and it will also be consitant broken down into tokens using the method we define now.

// export type Token = {
//   type: TokenType;
// };
/**
 * Rewriting the token type as an explicity Discriminated union:
 * The `type` field is the discriminant: it tells tells you which shape you are holding.
 * Only the Identifier variant carries and extra `name` - punctuation tokens have type only.
 */
export type Token =
  | { type: TokenType.LeftParen }
  | { type: TokenType.RightParen }
  | { type: TokenType.LeftCurly }
  | { type: TokenType.RightCurly }
  | { type: TokenType.Dot }
  | { type: TokenType.Semicolon }
  | { type: TokenType.Identifier; name: string };

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

  // Builds an identifier token, carrying the actual word text in `name`.
  identifier(name: string): Token {
    return { type: TokenType.Identifier, name: name };
  },
};

// tokenize function
// takes the source string returns an array of tokens
// Token[] retunrs type says explicitly "this hands back a list of token"

// Returns true if the character is a whitespace (space, tab, newline, etc)
// \s is a regex shorthand for "any one whitespace character".
// .test(...) returns true/false for whether the string matches the pattern
function isWhiteSpace(char: string): boolean {
  return /\s/.test(char);
}

// True is character is a single english letter(a-z or A-Z)
function isAlpha(char: string): boolean {
  return /[a-zA-Z]/.test(char);
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let current: number = 0;

  while (current < input.length) {
    const char: string | undefined = input[current];

    // If this character is a whitespace, it is not a token - skip it.
    if (char !== undefined && isWhiteSpace(char)) {
      current += 1;
      continue; // skip the test of THIS iteration, start the next one
    }

    // A letter means a word(identifier) is staring.
    if (char !== undefined && isAlpha(char)) {
      let name: string = ""; // the word we're building up, char by char

      // inner loop starts
      while (current < input.length) {
        const next: string | undefined = input[current];
        if (next === undefined || !isAlpha(next)) {
          break;
        }

        name += next;
        current += 1;
      }

      tokens.push(token.identifier(name)); // the finished word becomes one token
      continue; // cursor is already parked on the non-letter
    }

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

    current += 1;
  }

  return tokens;
}

console.log(tokenize("hi()"));

// Whitespace is not a token. In JavaScript, spaces and new lines only exist to separate other things; they carry no meaning of their own
// So, the tokenizer's job with whitespace is simple: skip it entirely. Dont produce a token, just move past it.
