// Testes de validação de entrada — sem dependências externas (usa assert nativo do Node).
// Execute com: npm test

const assert = require('assert');

// Funções replicadas do api/submit.js para teste isolado
function sanitize(str, maxLen = 500) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen);
}

function validatePhone(phone) {
  const clean = String(phone).replace(/\D/g, '');
  return clean.length >= 10 && clean.length <= 11;
}

const VALID_SERVICES = ['smartphone', 'notebook', 'custom-pc', 'ti-support', 'outro'];
const VALID_URGENCIES = ['Alta', 'Média', 'Baixa'];
const VALID_CLIENT_TYPES = ['Pessoa Física', 'Empresa/Escritório'];

function validateService(service) {
  return VALID_SERVICES.includes(service);
}

function validateUrgency(urgency) {
  return VALID_URGENCIES.includes(urgency);
}

function validateClientType(type) {
  return VALID_CLIENT_TYPES.includes(type);
}

// --- Testes de sanitize ---
assert.strictEqual(sanitize('  hello  '), 'hello', 'deve remover espaços');
assert.strictEqual(sanitize(null), '', 'null deve retornar string vazia');
assert.strictEqual(sanitize(undefined), '', 'undefined deve retornar string vazia');
assert.strictEqual(sanitize(123), '', 'número deve retornar string vazia');
assert.strictEqual(sanitize('a'.repeat(600)).length, 500, 'deve truncar em 500 chars');
assert.strictEqual(sanitize('teste', 3), 'tes', 'deve respeitar maxLen customizado');

// --- Testes de telefone ---
assert.ok(validatePhone('(11) 99999-9999'), 'telefone formatado válido');
assert.ok(validatePhone('11999999999'), 'celular 11 dígitos válido');
assert.ok(validatePhone('1134567890'), 'fixo 10 dígitos válido');
assert.ok(!validatePhone('123'), 'número curto inválido');
assert.ok(!validatePhone(''), 'vazio inválido');
assert.ok(!validatePhone('123456789012'), '12 dígitos inválido');

// --- Testes de categoria de serviço ---
assert.ok(validateService('smartphone'), 'smartphone válido');
assert.ok(validateService('notebook'), 'notebook válido');
assert.ok(validateService('custom-pc'), 'custom-pc válido');
assert.ok(validateService('ti-support'), 'ti-support válido');
assert.ok(validateService('outro'), 'outro válido');
assert.ok(!validateService(''), 'vazio inválido');
assert.ok(!validateService('hacking'), 'valor fora da lista inválido');
assert.ok(!validateService(undefined), 'undefined inválido');

// --- Testes de urgência ---
assert.ok(validateUrgency('Alta'), 'Alta válida');
assert.ok(validateUrgency('Média'), 'Média válida');
assert.ok(validateUrgency('Baixa'), 'Baixa válida');
assert.ok(!validateUrgency('Urgente'), 'valor fora da lista inválido');

// --- Testes de tipo de cliente ---
assert.ok(validateClientType('Pessoa Física'), 'PF válido');
assert.ok(validateClientType('Empresa/Escritório'), 'PJ válido');
assert.ok(!validateClientType('outro'), 'valor fora da lista inválido');

console.log('✓ Todos os testes passaram!');
