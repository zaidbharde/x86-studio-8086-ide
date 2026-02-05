import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Bug, Code2, FileCode, Terminal, Cpu, 
  ChevronRight, Zap, Layers, BookOpen,
  RotateCcw, StepForward, ArrowLeft, Sparkles,
  Check, X
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { CodeEditor } from '@/components/CodeEditor';
import { RegisterDisplay } from '@/components/RegisterDisplay';

import { compile, SAMPLE_PROGRAMS, CompilationResult } from '@/compiler/compiler';
import { runProgram, createInitialState, executeInstruction, parseRegister, ProgramOutput } from '@/emulator/cpu';
import { assemble } from '@/emulator/assembler';
import { AssembledProgram, CPUState } from '@/types/cpu';
import { cn } from '@/utils/cn';

type ViewMode = 'home' | 'editor' | 'asm-editor' | 'debug';
type EditorTab = 'source' | 'assembly' | 'output';

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [sourceCode, setSourceCode] = useState(SAMPLE_PROGRAMS.countdown);
  const [asmCode, setAsmCode] = useState('');
  const [compilationResult, setCompilationResult] = useState<CompilationResult | null>(null);
  const [debugProgram, setDebugProgram] = useState<AssembledProgram | null>(null);
  const [editorTab, setEditorTab] = useState<EditorTab>('source');
  const [runOutput, setRunOutput] = useState<string>('');
  const [isCompiling, setIsCompiling] = useState(false);

  // Debug state
  const [debugState, setDebugState] = useState<CPUState>(createInitialState);
  const [debugHistory, setDebugHistory] = useState<CPUState[]>([]);
  const [debugOutput, setDebugOutput] = useState<ProgramOutput[]>([]);
  const [debugOutputSteps, setDebugOutputSteps] = useState<number[]>([]);
  const [previousDebugState, setPreviousDebugState] = useState<CPUState | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && viewMode !== 'home') {
        setViewMode('home');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode]);

  const formatOutput = (output: ProgramOutput[]): string => {
    let result = '';
    let currentLine = '';
    
    for (const item of output) {
      if (item.type === 'char') {
        if (item.value === 10) { // newline
          result += currentLine + '\n';
          currentLine = '';
        } else {
          currentLine += String.fromCharCode(item.value);
        }
      } else {
        if (currentLine) {
          result += currentLine;
          currentLine = '';
        }
        result += item.value + '\n';
      }
    }
    
    if (currentLine) {
      result += currentLine;
    }
    
    return result;
  };

  const outputIsError = runOutput.includes('Error:') || runOutput.includes('Compilation failed');

  const handleCompile = useCallback(() => {
    setIsCompiling(true);
    setTimeout(() => {
      const result = compile(sourceCode);
      setCompilationResult(result);
      if (result.success && result.assembly) {
        setAsmCode(result.assembly);
      }
      setEditorTab('assembly');
      setIsCompiling(false);
    }, 300);
  }, [sourceCode]);

  const handleRun = useCallback(() => {
    const result = compile(sourceCode);
    setCompilationResult(result);
    
    if (result.success && result.program) {
      const { finalState, output } = runProgram(result.program);
      let outputStr = formatOutput(output);
      
      if (finalState.error) {
        outputStr += `\n\nError: ${finalState.error}`;
      } else {
        outputStr += '\n\nProgram completed successfully';
      }
      
      setRunOutput(outputStr);
      setEditorTab('output');
    } else {
      // Show compilation errors
      const errorStr = result.errors.map(e => `Line ${e.line}: ${e.message}`).join('\n');
      setRunOutput(`Compilation failed:\n\n${errorStr}`);
      setEditorTab('output');
    }
  }, [sourceCode]);

  const handleDebug = useCallback(() => {
    const result = compile(sourceCode);
    setCompilationResult(result);
    
    if (result.success && result.program) {
      setDebugProgram(result.program);
      const initial = createInitialState();
      setDebugState(initial);
      setDebugHistory([initial]);
      setDebugOutput([]);
      setDebugOutputSteps([]);
      setPreviousDebugState(null);
      setViewMode('debug');
    }
  }, [sourceCode]);

  const debugStep = useCallback(() => {
    if (!debugProgram || debugState.halted) return;
    
    const ip = debugState.registers.IP;
    if (ip < 0 || ip >= debugProgram.instructions.length) {
      setDebugState(s => ({ ...s, halted: true, error: 'IP out of bounds' }));
      return;
    }

    const instruction = debugProgram.instructions[ip];
    
    // Capture output before execution
    let outputAdded = 0;
    if (instruction.opcode.toUpperCase() === 'OUT') {
      const reg = instruction.operands[0].toUpperCase().trim();
      const regKey = parseRegister(reg);
      if (regKey) {
        outputAdded = 1;
        setDebugOutput(o => [...o, { type: 'number', value: debugState.registers[regKey] }]);
      }
    } else if (instruction.opcode.toUpperCase() === 'OUTC') {
      const reg = instruction.operands[0].toUpperCase().trim();
      const regKey = parseRegister(reg);
      if (regKey) {
        outputAdded = 1;
        setDebugOutput(o => [...o, { type: 'char', value: debugState.registers[regKey] & 0xFF }]);
      }
    }

    setDebugOutputSteps(steps => [...steps, outputAdded]);
    setPreviousDebugState(debugState);
    const newState = executeInstruction(debugState, instruction, debugProgram.labels);
    setDebugState(newState);
    setDebugHistory(h => [...h, newState]);
  }, [debugState, debugProgram]);

  const debugStepBack = useCallback(() => {
    if (debugHistory.length > 1) {
      const newHistory = [...debugHistory];
      newHistory.pop();
      const prevState = newHistory[newHistory.length - 1];
      setDebugState(prevState);
      setPreviousDebugState(newHistory[newHistory.length - 2] || null);
      setDebugHistory(newHistory);
      const newOutputSteps = [...debugOutputSteps];
      const removed = newOutputSteps.pop() ?? 0;
      setDebugOutputSteps(newOutputSteps);
      if (removed > 0) {
        setDebugOutput(o => o.slice(0, -removed));
      }
    }
  }, [debugHistory, debugOutputSteps]);

  const debugReset = useCallback(() => {
    const initial = createInitialState();
    setDebugState(initial);
    setDebugHistory([initial]);
    setDebugOutput([]);
    setDebugOutputSteps([]);
    setPreviousDebugState(null);
  }, []);

  const debugRunToEnd = useCallback(() => {
    if (!debugProgram) return;
    
    let currentState = debugState;
    let steps = 0;
    const newOutput: ProgramOutput[] = [...debugOutput];
    const newHistory: CPUState[] = [...debugHistory];
    const newOutputSteps: number[] = [...debugOutputSteps];

    while (!currentState.halted && steps < 10000) {
      const ip = currentState.registers.IP;
      if (ip < 0 || ip >= debugProgram.instructions.length) {
        currentState = { ...currentState, halted: true, error: 'IP out of bounds' };
        break;
      }

      const instruction = debugProgram.instructions[ip];
      
      let outputAdded = 0;
      if (instruction.opcode.toUpperCase() === 'OUT') {
        const reg = parseRegister(instruction.operands[0]);
        if (reg) {
          outputAdded = 1;
          newOutput.push({ type: 'number', value: currentState.registers[reg] });
        }
      } else if (instruction.opcode.toUpperCase() === 'OUTC') {
        const reg = parseRegister(instruction.operands[0]);
        if (reg) {
          outputAdded = 1;
          newOutput.push({ type: 'char', value: currentState.registers[reg] & 0xFF });
        }
      }

      currentState = executeInstruction(currentState, instruction, debugProgram.labels);
      newHistory.push(currentState);
      newOutputSteps.push(outputAdded);
      steps++;
    }

    if (steps >= 10000 && !currentState.halted) {
      currentState = { ...currentState, error: 'Maximum steps exceeded (infinite loop?)', halted: true };
    }

    if (newHistory[newHistory.length - 1] !== currentState) {
      newHistory.push(currentState);
      newOutputSteps.push(0);
    }

    setDebugState(currentState);
    setDebugHistory(newHistory);
    setDebugOutput(newOutput);
    setDebugOutputSteps(newOutputSteps);
    setPreviousDebugState(newHistory[newHistory.length - 2] || null);
  }, [debugState, debugProgram, debugOutput, debugHistory, debugOutputSteps]);

  // Home View
  if (viewMode === 'home') {
    return (
      <div className="min-h-screen bg-[#0b1110] bg-grid relative overflow-hidden">
        <div className="noise-overlay" />
        
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#45d1a3]/20 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#e0b56a]/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
        </div>

        <div className="relative z-10 container mx-auto px-6 py-12">
          {/* Header */}
          <motion.header 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-16"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#45d1a3] to-[#e0b56a] flex items-center justify-center">
                <Cpu className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">x86 Studio</span>
            </div>
            <Badge variant="info" dot>v2.1</Badge>
          </motion.header>

          {/* Hero Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center mb-16"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#45d1a3]/10 border border-[#45d1a3]/20 text-[#7adfb1] text-sm mb-6"
            >
              <Sparkles className="w-4 h-4" />
              <span>Powered by Virtual Intel 8086 CPU</span>
            </motion.div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              <span className="gradient-text">Virtual 8086</span>
              <br />
              <span className="text-white">Programming IDE</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
              A complete compiler, assembler, and virtual CPU environment. 
              Write high-level code and watch it execute on a simulated Intel 8086.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button 
                size="lg" 
                onClick={() => setViewMode('editor')}
                icon={<Sparkles className="w-5 h-5" />}
              >
                Start Coding
              </Button>
              <Button 
                variant="secondary" 
                size="lg"
                onClick={() => setViewMode('asm-editor')}
                icon={<Code2 className="w-5 h-5" />}
              >
                Assembly Mode
              </Button>
            </div>
          </motion.div>

          {/* Feature Cards */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16"
          >
            <FeatureCard
              icon={<Layers className="w-6 h-6" />}
              title="Full Compiler Pipeline"
              description="Lexer, Parser, Code Generator, and Assembler working in harmony."
            />
            <FeatureCard
              icon={<Cpu className="w-6 h-6" />}
              title="Virtual 8086 CPU"
              description="Accurate registers, flags, memory addressing, and core instructions."
            />
            <FeatureCard
              icon={<Bug className="w-6 h-6" />}
              title="Step Debugger"
              description="Step through execution, inspect registers, and track program flow."
            />
          </motion.div>

          {/* Sample Programs */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Sample Programs</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.entries(SAMPLE_PROGRAMS).map(([name, code]) => (
                <motion.button
                  key={name}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSourceCode(code);
                    setViewMode('editor');
                  }}
                  className="p-4 rounded-xl bg-[#13201e] border border-[#1f2b29] hover:border-[#45d1a3]/50 transition-all text-left"
                >
                  <FileCode className="w-5 h-5 text-[#45d1a3] mb-2" />
                  <span className="text-sm font-medium text-white capitalize">{name}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Editor View
  if (viewMode === 'editor') {
    return (
      <div className="min-h-screen bg-[#0b1110] flex flex-col">
        {/* Top Bar */}
        <div className="h-14 border-b border-[#1f2b29] bg-[#0f1716] flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setViewMode('home')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="h-6 w-px bg-[#1f2b29]" />
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#45d1a3]" />
              <span className="font-semibold text-white">High-Level Editor</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleCompile}
              loading={isCompiling}
              icon={<Code2 className="w-4 h-4" />}
            >
              Compile
            </Button>
            <Button 
              variant="success" 
              size="sm" 
              onClick={handleRun}
              icon={<Play className="w-4 h-4" />}
            >
              Run
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleDebug}
              icon={<Bug className="w-4 h-4" />}
            >
              Debug
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Editor Panel */}
          <div className="flex-1 flex flex-col min-w-0">
            <Tabs
              tabs={[
                { id: 'source', label: 'Source', icon: <FileCode className="w-4 h-4" /> },
                { id: 'assembly', label: 'Assembly', icon: <Code2 className="w-4 h-4" /> },
                { id: 'output', label: 'Output', icon: <Terminal className="w-4 h-4" /> },
              ]}
              activeTab={editorTab}
              onTabChange={(id) => setEditorTab(id as EditorTab)}
              className="m-2"
            />
            
            <div className="flex-1 p-2 pt-0">
              <AnimatePresence mode="wait">
                {editorTab === 'source' && (
                  <motion.div
                    key="source"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full"
                  >
                    <CodeEditor
                      value={sourceCode}
                      onChange={setSourceCode}
                      language="high-level"
                      className="h-full"
                    />
                  </motion.div>
                )}
                {editorTab === 'assembly' && (
                  <motion.div
                    key="assembly"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full"
                  >
                    <CodeEditor
                      value={compilationResult?.assembly || '; Compile your code to see generated assembly'}
                      onChange={() => {}}
                      language="assembly"
                      readOnly
                      className="h-full"
                    />
                  </motion.div>
                )}
                {editorTab === 'output' && (
                  <motion.div
                    key="output"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full bg-[#0d1513] rounded-lg border border-[#1f2b29] p-4 font-mono text-sm"
                  >
                    {runOutput ? (
                      <pre className={cn('whitespace-pre-wrap', outputIsError ? 'text-[#f38b8b]' : 'text-[#5de6a0]')}>
                        {runOutput}
                      </pre>
                    ) : (
                      <span className="text-gray-500">Run your program to see output</span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Side Panel */}
          <div className="w-80 border-l border-[#1f2b29] bg-[#0f1716] p-4 overflow-y-auto">
            {/* Compilation Status */}
            {compilationResult && (
              <Card className="mb-4">
                <CardHeader 
                  title="Compilation" 
                  icon={compilationResult.success ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                />
                <CardContent>
                  <div className="space-y-2">
                    {compilationResult.stages.map((stage, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">{stage.name}</span>
                        <Badge variant={stage.success ? 'success' : 'error'} size="sm">
                          {stage.success ? 'Pass' : 'Fail'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Reference */}
            <Card>
              <CardHeader title="Quick Reference" icon={<BookOpen className="w-4 h-4" />} />
              <CardContent>
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-gray-500 block mb-1">Simple & Easy Syntax:</span>
                    <pre className="text-[#7adfb1] font-mono bg-[#0b1110] p-2 rounded">{`# No program declaration needed!
x = 10
y = x + 5

if x < y
  print x
end

while x > 0
  x = x - 1
end

print "Hello!"`}</pre>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-1">Operators:</span>
                    <code className="text-[#e0b56a]">+ - * / % {'<'} {'>'} {'<='} {'>='} == !=</code>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-1">Keywords:</span>
                    <code className="text-[#e0b56a]">if else end while for print</code>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Assembly Editor View
  if (viewMode === 'asm-editor') {
    const handleAsmRun = () => {
      const program = assemble(asmCode || DEFAULT_ASM);
      if (program.errors.filter(e => e.type === 'error').length > 0) {
        setRunOutput(`Error:\n${program.errors.map(e => `Line ${e.line}: ${e.message}`).join('\n')}`);
        return;
      }
      
      const { finalState, output } = runProgram(program);
      let outputStr = formatOutput(output);
      if (finalState.error) {
        outputStr += `\n\nError: ${finalState.error}`;
      } else {
        outputStr += '\n\nProgram completed successfully';
      }
      setRunOutput(outputStr);
    };

    return (
      <div className="min-h-screen bg-[#0b1110] flex flex-col">
        {/* Top Bar */}
        <div className="h-14 border-b border-[#1f2b29] bg-[#0f1716] flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setViewMode('home')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="h-6 w-px bg-[#1f2b29]" />
            <div className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-[#e0b56a]" />
              <span className="font-semibold text-white">Assembly Editor</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="success" 
              size="sm" 
              onClick={handleAsmRun}
              icon={<Play className="w-4 h-4" />}
            >
              Run
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 p-4">
            <CodeEditor
              value={asmCode || DEFAULT_ASM}
              onChange={setAsmCode}
              language="assembly"
              className="h-full"
            />
          </div>
          
          <div className="w-80 border-l border-[#1f2b29] bg-[#0f1716] p-4 overflow-y-auto">
            <Card className="mb-4">
              <CardHeader title="Output" icon={<Terminal className="w-4 h-4" />} />
              <CardContent>
                <pre className={cn(
                  'text-xs font-mono whitespace-pre-wrap',
                  outputIsError ? 'text-[#f38b8b]' : 'text-[#5de6a0]'
                )}>
                  {runOutput || 'Run your program to see output'}
                </pre>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader title="Instructions" icon={<BookOpen className="w-4 h-4" />} />
              <CardContent>
                <div className="space-y-2 text-xs font-mono">
                  <div className="text-gray-500">Data Movement:</div>
                  <div className="text-[#7ab6ff]">MOV, PUSH, POP (supports [addr])</div>
                  <div className="text-gray-500 mt-2">Arithmetic:</div>
                  <div className="text-[#7ab6ff]">ADD, ADC, SUB, SBB, MUL, DIV, MOD, INC, DEC, NEG</div>
                  <div className="text-gray-500 mt-2">Logic:</div>
                  <div className="text-[#7ab6ff]">AND, OR, XOR, NOT, SHL, SAL, SHR, SAR</div>
                  <div className="text-gray-500 mt-2">Compare & Jump:</div>
                  <div className="text-[#7ab6ff]">CMP, JMP, JE/JZ, JNE/JNZ, JL/JG, JLE/JGE, JC/JNC, JS/JNS, JO/JNO</div>
                  <div className="text-gray-500 mt-2">Control:</div>
                  <div className="text-[#7ab6ff]">HLT, NOP, OUT, OUTC, CLC, STC, CMC</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Debug View
  if (viewMode === 'debug' && debugProgram) {
    const currentInstruction = debugProgram.instructions[debugState.registers.IP];
    
    return (
      <div className="min-h-screen bg-[#0b1110] flex flex-col">
        {/* Top Bar */}
        <div className="h-14 border-b border-[#1f2b29] bg-[#0f1716] flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setViewMode('editor')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="h-6 w-px bg-[#1f2b29]" />
            <div className="flex items-center gap-2">
              <Bug className="w-5 h-5 text-[#f0b45b]" />
              <span className="font-semibold text-white">Debugger</span>
            </div>
            <Badge variant={debugState.halted ? 'error' : 'success'} dot>
              {debugState.halted ? 'Halted' : 'Running'}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={debugReset}
              icon={<RotateCcw className="w-4 h-4" />}
            >
              Reset
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={debugStepBack}
              disabled={debugHistory.length <= 1}
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Back
            </Button>
            <Button 
              variant="primary" 
              size="sm" 
              onClick={debugStep}
              disabled={debugState.halted}
              icon={<StepForward className="w-4 h-4" />}
            >
              Step
            </Button>
            <Button 
              variant="success" 
              size="sm" 
              onClick={debugRunToEnd}
              disabled={debugState.halted}
              icon={<Play className="w-4 h-4" />}
            >
              Run
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Instructions */}
          <div className="flex-1 p-4 overflow-auto">
            <Card className="h-full">
              <CardHeader title="Instructions" icon={<Code2 className="w-4 h-4" />} />
              <CardContent noPadding className="overflow-auto max-h-[calc(100vh-200px)]">
                <div className="font-mono text-sm">
                  {debugProgram.instructions.map((instr, i) => {
                    const isCurrent = i === debugState.registers.IP;
                    return (
                      <motion.div
                        key={i}
                        initial={false}
                        animate={isCurrent ? { backgroundColor: 'rgba(240, 180, 91, 0.12)' } : { backgroundColor: 'transparent' }}
                        className={cn(
                          'flex items-center px-4 py-1 border-l-2 transition-all',
                          isCurrent ? 'border-[#f0b45b]' : 'border-transparent'
                        )}
                      >
                        <span className="w-8 text-gray-600 text-xs">{i.toString().padStart(3, '0')}</span>
                        {isCurrent && <ChevronRight className="w-4 h-4 text-[#f0b45b] mr-2" />}
                        <span className={cn('text-[#e0b56a] font-semibold w-12', !isCurrent && 'ml-6')}>{instr.opcode}</span>
                        <span className="text-gray-300">{instr.operands.join(', ')}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Side Panel */}
          <div className="w-96 border-l border-[#1f2b29] bg-[#0f1716] p-4 overflow-y-auto space-y-4">
            {/* Current Instruction */}
            <Card>
              <CardHeader title="Current Instruction" icon={<Zap className="w-4 h-4" />} />
              <CardContent>
                {currentInstruction ? (
                  <div className="font-mono">
                    <span className="text-2xl font-bold text-[#f0b45b]">{currentInstruction.opcode}</span>
                    <span className="text-lg text-gray-300 ml-3">{currentInstruction.operands.join(', ')}</span>
                  </div>
                ) : (
                  <span className="text-gray-500">End of program</span>
                )}
              </CardContent>
            </Card>

            {/* Registers */}
            <Card>
              <CardHeader title="Registers" icon={<Cpu className="w-4 h-4" />} />
              <CardContent>
                <RegisterDisplay 
                  registers={debugState.registers}
                  previousRegisters={previousDebugState?.registers}
                  showAllRegisters={true}
                />
              </CardContent>
            </Card>

            {/* Output */}
            <Card>
              <CardHeader title="Program Output" icon={<Terminal className="w-4 h-4" />} />
              <CardContent>
                <div className="font-mono text-sm">
                  {debugOutput.length > 0 ? (
                    <pre className="text-[#5de6a0] whitespace-pre-wrap">
                      {formatOutput(debugOutput)}
                    </pre>
                  ) : (
                    <span className="text-gray-500">No output yet</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Memory */}
            <Card>
              <CardHeader title="Memory" icon={<Layers className="w-4 h-4" />} />
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Stack (SP)</span>
                    <div className="mt-2">
                      <MemoryView
                        memory={debugState.memory}
                        start={(Math.max(0, debugState.registers.SP - 10) & ~1)}
                        words={6}
                        highlightAddress={debugState.registers.SP}
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Data Segment (0100h)</span>
                    <div className="mt-2">
                      <MemoryView
                        memory={debugState.memory}
                        start={0x0100}
                        words={8}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Error */}
            {debugState.error && (
              <Card className="border-[#e05d5d]/40">
                <CardContent>
                  <div className="flex items-center gap-2 text-[#f38b8b]">
                    <X className="w-4 h-4" />
                    <span className="text-sm">{debugState.error}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stats */}
            <Card>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Steps Executed</span>
                  <span className="font-mono text-white">{debugHistory.length - 1}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function formatHex(value: number, width: number = 4) {
  return value.toString(16).toUpperCase().padStart(width, '0');
}

function MemoryView({
  memory,
  start,
  words,
  highlightAddress
}: {
  memory: Uint8Array;
  start: number;
  words: number;
  highlightAddress?: number;
}) {
  const rows = Array.from({ length: words }, (_, i) => {
    const addr = start + i * 2;
    const valid = addr >= 0 && addr + 1 < memory.length;
    const value = valid ? memory[addr] | (memory[addr + 1] << 8) : null;
    return { addr, value, valid, highlight: highlightAddress === addr };
  });

  return (
    <div className="grid grid-cols-2 gap-2 font-mono text-xs">
      {rows.map((row) => (
        <div
          key={row.addr}
          className={cn(
            'flex items-center justify-between rounded-md border px-2 py-1',
            row.highlight
              ? 'border-[#f0b45b]/60 bg-[#f0b45b]/10 text-[#f0b45b]'
              : 'border-[#1f2b29] bg-[#0f1716] text-gray-400'
          )}
        >
          <span>{formatHex(row.addr)}</span>
          <span className={cn('text-gray-200', row.highlight && 'text-[#f0b45b]')}>
            {row.value !== null ? formatHex(row.value) : '----'}
          </span>
        </div>
      ))}
    </div>
  );
}

// Feature Card Component
function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="p-6 rounded-2xl bg-[#13201e] border border-[#1f2b29] hover:border-[#45d1a3]/30 transition-all"
    >
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#45d1a3]/20 to-[#e0b56a]/20 flex items-center justify-center text-[#45d1a3] mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </motion.div>
  );
}

const DEFAULT_ASM = `; 8086 Assembly Program
; Simple counter example

    MOV AX, 10    ; Initialize counter
    MOV BX, 0     ; Initialize sum

LOOP:
    ADD BX, AX    ; Add counter to sum
    DEC AX        ; Decrement counter
    CMP AX, 0     ; Check if zero
    JNE LOOP      ; Continue if not

    OUT BX        ; Output the sum
    HLT           ; Halt execution
`;

