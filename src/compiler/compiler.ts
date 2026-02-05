// Main Compiler Pipeline
import { tokenize } from './lexer';
import { parse, formatAST } from './parser';
import { generateCode, resetCodeGen } from './codegen';
import { assemble } from '../emulator/assembler';
import { CompilerError, AssembledProgram, ASTNode } from '../types/cpu';

export interface CompilationResult {
  success: boolean;
  tokens: string;
  ast: string;
  assembly: string;
  program: AssembledProgram | null;
  errors: CompilerError[];
  stages: CompilationStage[];
}

export interface CompilationStage {
  name: string;
  success: boolean;
  output: string;
  errors: CompilerError[];
}

export function compile(source: string): CompilationResult {
  const stages: CompilationStage[] = [];
  const allErrors: CompilerError[] = [];
  
  // Reset code generator state
  resetCodeGen();

  // Stage 1: Lexical Analysis
  const { tokens, errors: lexerErrors } = tokenize(source);
  allErrors.push(...lexerErrors);
  
  const tokenStr = tokens
    .filter(t => t.type !== 'NEWLINE' && t.type !== 'EOF')
    .map(t => `[${t.type}: "${t.value}"]`)
    .join(' ');
  
  stages.push({
    name: 'Lexical Analysis',
    success: lexerErrors.filter(e => e.type === 'error').length === 0,
    output: tokenStr,
    errors: lexerErrors
  });

  if (lexerErrors.filter(e => e.type === 'error').length > 0) {
    return {
      success: false,
      tokens: tokenStr,
      ast: '',
      assembly: '',
      program: null,
      errors: allErrors,
      stages
    };
  }

  // Stage 2: Parsing
  const { ast, errors: parseErrors } = parse(tokens);
  allErrors.push(...parseErrors);
  
  const astStr = ast ? formatAST(ast) : '';
  
  stages.push({
    name: 'Parsing',
    success: parseErrors.filter(e => e.type === 'error').length === 0 && ast !== null,
    output: astStr,
    errors: parseErrors
  });

  if (parseErrors.filter(e => e.type === 'error').length > 0 || !ast) {
    return {
      success: false,
      tokens: tokenStr,
      ast: astStr,
      assembly: '',
      program: null,
      errors: allErrors,
      stages
    };
  }

  // Stage 3: Code Generation
  const { assembly, errors: codegenErrors } = generateCode(ast as ASTNode);
  allErrors.push(...codegenErrors);
  
  stages.push({
    name: 'Code Generation',
    success: codegenErrors.filter(e => e.type === 'error').length === 0,
    output: assembly,
    errors: codegenErrors
  });

  if (codegenErrors.filter(e => e.type === 'error').length > 0) {
    return {
      success: false,
      tokens: tokenStr,
      ast: astStr,
      assembly,
      program: null,
      errors: allErrors,
      stages
    };
  }

  // Stage 4: Assembly
  const program = assemble(assembly);
  allErrors.push(...program.errors);
  
  const asmOutput = program.instructions
    .map((instr, i) => `${i.toString().padStart(4, '0')}: ${instr.raw}`)
    .join('\n');
  
  stages.push({
    name: 'Assembly',
    success: program.errors.filter(e => e.type === 'error').length === 0,
    output: asmOutput,
    errors: program.errors
  });

  const hasErrors = allErrors.filter(e => e.type === 'error').length > 0;

  return {
    success: !hasErrors,
    tokens: tokenStr,
    ast: astStr,
    assembly,
    program: hasErrors ? null : program,
    errors: allErrors,
    stages
  };
}

// Sample programs for demonstration - Simple Python-like syntax, no program declaration needed!
export const SAMPLE_PROGRAMS = {
  simple: `# Simple variables
x = 10
y = 20
print x
print y
`,

  addition: `# Addition example
a = 99
b = 20
c = a + b
print c
`,

  conditional: `# Conditional example
x = 10
y = 20

if x < y
  print x
end

if y > x
  print y
end
`,

  loop: `# While loop
x = 0

while x < 5
  print x
  x = x + 1
end
`,

  countdown: `# Countdown from 10
x = 10

while x > 0
  print x
  x = x - 1
end
print 0
`,

  fibonacci: `# Fibonacci sequence
a = 0
b = 1
print a
print b

i = 0
while i < 8
  c = a + b
  print c
  a = b
  b = c
  i = i + 1
end
`,

  math: `# Math operations
a = 100
b = 25

sum = a + b
diff = a - b

print sum
print diff
`,

  strings: `# String printing
print "Hello World!"
x = 42
print x
print "Done!"
`
};
