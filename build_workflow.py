import urllib.request, urllib.error, json, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

N8N          = "http://143.20.0.197:5678"
SUPA_URL     = "https://pfodcrnisntawxqsywld.supabase.co"
SUPA_KEY     = "sb_publishable_Vip8SjvB27zSCuDI_MVXKg_Iy2tB0DW"
EVO_INSTANCE = "test"
EVO_URL      = "http://icc-evolution:8080"
# Cole aqui sua GROQ_API_KEY (copiada do Vercel → Settings → Environment Variables)
import os
GROQ_KEY     = os.environ.get("GROQ_API_KEY", "")  # export GROQ_API_KEY=gsk_... antes de rodar

def req(method, path, body=None, cookie=""):
    h = {"Content-Type": "application/json"}
    if cookie: h["Cookie"] = "n8n-auth=" + cookie
    r = urllib.request.Request(N8N + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            sc = resp.headers.get("Set-Cookie","")
            raw = resp.read()
            return resp.status, json.loads(raw) if raw else {}, sc
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read()), ""
        except: return e.code, {}, ""

# Login
s, r, sc = req("POST", "/rest/login", {"emailOrLdapLoginId": "iagopuma0@gmail.com", "password": "!F2w4r8vu"})
jwt = [p[len("n8n-auth="):] for p in sc.split(";") if p.strip().startswith("n8n-auth=")][0]
print(f"Login: {s}")

# Deletar workflows existentes
s, r, _ = req("GET", "/rest/workflows", cookie=jwt)
for wf in r.get("data", []):
    req("DELETE", f"/rest/workflows/{wf['id']}", cookie=jwt)
    print(f"Deletado: {wf['name']}")

# ── JavaScript dos Code nodes ──────────────────────────────────────────────────

# Extrai dados da mensagem — sem keyword matching (a IA faz isso agora)
PARSE_JS = """
const item = $input.first().json;

// Notificação interna de mudança de reparo (vinda do Supabase via webhook)
if (item.event && item.event.startsWith('repair.')) {
  return [{json:{
    intent: 'supabase_repair',
    phone:     String(item.whatsapp || ''),
    pushName:  String(item.name || 'Cliente'),
    newStatus: String(item.new_status || ''),
    oldStatus: String(item.old_status || ''),
    device:    String(item.device || ''),
    repairId:  item.repair_id || null,
    messageText: '',
  }}];
}

if (item.event !== 'messages.upsert') return [];

const msg       = item.data || {};
const remoteJid = String(msg?.key?.remoteJid || '');
if (remoteJid.includes('@g.us') || msg?.key?.fromMe) return [];

const phone     = remoteJid.split('@')[0];
const pushName  = String(msg?.pushName || '');
const text      = String(
  msg?.message?.conversation ||
  msg?.message?.extendedTextMessage?.text ||
  msg?.message?.imageMessage?.caption || ''
).trim();

return [{json:{
  intent: 'pending_ai',   // será sobrescrito pelo nó de IA
  phone, pushName, messageText: text,
  newStatus: '', oldStatus: '', device: '', repairId: null,
  aiDevice: null, aiProblem: null, aiUrgency: null,
}}];
"""

# Extrai e valida o JSON retornado pelo Groq
PARSE_IA_JS = """
const raw      = $input.first().json;
const parsed   = $('Parse Event').first().json;
const content  = raw?.choices?.[0]?.message?.content || '{}';

let ai = {};
try {
  // Remove possível markdown ```json ... ``` que o modelo às vezes adiciona
  const clean = content.replace(/```json|```/g, '').trim();
  ai = JSON.parse(clean);
} catch(e) {
  ai = { intent: 'outro' };
}

const validIntents = ['lead', 'consulta_status', 'saudacao', 'orcamento', 'atendente', 'outro'];
if (!validIntents.includes(ai.intent)) ai.intent = 'outro';

return [{json:{
  ...parsed,
  intent:     ai.intent,
  aiDevice:   ai.device   || null,
  aiProblem:  ai.problem  || null,
  aiUrgency:  ai.urgency  || null,
}}];
"""

# Formata a resposta da consulta de status para WhatsApp
FMT_STATUS_JS = """
const parsed = $('Parse IA').first().json;
const rows   = $input.first().json;  // array retornado pela RPC

const phone  = parsed.phone;
const name   = parsed.pushName || 'Cliente';

if (!rows || !Array.isArray(rows) || rows.length === 0) {
  const msg = 'Ola ' + name + '! Nao encontrei nenhum reparo ativo vinculado ao seu numero.\\n\\nQuer solicitar um orcamento? E so me dizer o aparelho e o problema!';
  return [{json:{phone, message: msg}}];
}

const STATUS_EMOJI = {
  'Entrada':         '📥',
  'Em Analise':      '🔍',
  'Em Reparo':       '🔧',
  'Aguardando Peca': '📦',
  'Pronto':          '✅',
  'Entregue':        '🎉',
};

let lines = 'Ola ' + name + '! Aqui esta o status dos seus reparos:\\n';
rows.forEach((r, i) => {
  const emoji  = STATUS_EMOJI[r.status] || '📋';
  const device = r.device_model || 'Aparelho';
  const status = r.status || 'Em andamento';
  const date   = r.updated_at ? new Date(r.updated_at).toLocaleDateString('pt-BR') : '';
  lines += '\\n' + (i+1) + '. ' + emoji + ' *' + device + '*\\n';
  lines += '   Status: *' + status + '*';
  if (date) lines += '   Atualizado em: ' + date;
  if (r.status === 'Pronto') lines += '\\n   Pode passar para retirar!';
  if (r.status === 'Aguardando Peca') lines += '\\n   Te avisamos quando a peca chegar.';
});

lines += '\\n\\nQualquer duvida e so chamar!';
return [{json:{phone, message: lines}}];
"""

# Formata a notificação automática de mudança de status (enviada pelo Supabase)
FMT_NOTIF_JS = """
const item   = $input.first().json;
const name   = item.pushName || 'Cliente';
const device = item.device   || 'seu aparelho';
const status = item.newStatus;
const phone  = item.phone;

const MSGS = {
  'Em Analise':      '🔍 Recebemos seu *' + device + '* e ja iniciamos a analise. Te mantemos informado!',
  'Em Reparo':       '🔧 O reparo do seu *' + device + '* comecou. Em breve fica pronto!',
  'Aguardando Peca': '📦 Precisamos de uma peca para o *' + device + '*. Te avisamos assim que chegar!',
  'Pronto':          '✅ Seu *' + device + '* esta *pronto para retirada*! Pode passar na loja.',
  'Entregue':        '🎉 Obrigado pela confianca! Qualquer problema nos chame.',
};

const base = MSGS[status] || ('O status do seu *' + device + '* mudou para: *' + status + '*.');
return [{json:{phone, message: 'Ola ' + name + '! ' + base}}];
"""

# Resposta para leads novos (IA classificou como lead, saudacao ou outro)
WELCOME_JS = """
const p    = $('Parse IA').first().json;
const name = p.pushName || '';
const greet = name ? ('Ola *' + name + '*! ') : 'Ola! ';

const menu = '\\n\\n' +
  '1️⃣ Ver status do meu reparo\\n' +
  '2️⃣ Solicitar orcamento\\n' +
  '3️⃣ Falar com o Iago diretamente';

let message;
if (p.aiDevice || p.aiProblem) {
  // Tem informacao extraida pela IA — confirma e pergunta mais
  const device  = p.aiDevice  ? ' do *' + p.aiDevice + '*' : '';
  const problem = p.aiProblem ? ' com problema de *' + p.aiProblem + '*' : '';
  message = greet + 'Recebi seu contato sobre o aparelho' + device + problem + '.\\n\\nVou verificar e retorno em breve com o orcamento!\\n\\nPosso ajudar com mais alguma coisa?' + menu;
} else {
  message = greet + 'Sou o assistente da *ICC Tecnologia*.\\n\\nComo posso ajudar?' + menu;
}

return [{json:{phone: p.phone, message}}];
"""

ORC_JS = """
const p = $('Parse IA').first().json;
const device = p.aiDevice ? ' do *' + p.aiDevice + '*' : '';
return [{json:{
  phone: p.phone,
  message: 'Certo! Para o orcamento' + device + ', nos conte:\\n👉 Qual o modelo exato e o problema?\\n\\nRetornamos em breve com os valores!'
}}];
"""

ATEND_JS = """
const p = $('Parse IA').first().json;
return [{json:{
  phone: p.phone,
  message: 'Certo! O Iago entrara em contato pessoalmente em breve.\\n⏰ Horario: seg-sex, 9h-18h'
}}];
"""

PASSTHROUGH_JS = """
return [$('Parse IA').first()];
"""

# ── Helpers ────────────────────────────────────────────────────────────────────
SUPA_HEADERS = [
    {"name":"apikey",        "value": SUPA_KEY},
    {"name":"Authorization", "value": "Bearer " + SUPA_KEY},
    {"name":"Content-Type",  "value": "application/json"},
]

def send_node(nid, name, x, y):
    return {
        "id": nid, "name": name,
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.1, "position": [x, y],
        "parameters": {
            "method": "POST",
            "url": EVO_URL + "/message/sendText/" + EVO_INSTANCE,
            "sendHeaders": True,
            "headerParameters": {"parameters": [{"name":"apikey","value":"!F2w4r8vu"}]},
            "sendBody": True, "specifyBody": "json",
            "jsonBody": '={"number":"{{ $json.phone }}","textMessage":{"text":"{{ $json.message }}"}}',
            "options": {}
        }
    }

def code_node(nid, name, x, y, js):
    return {"id":nid,"name":name,"type":"n8n-nodes-base.code","typeVersion":2,
            "position":[x,y],"parameters":{"jsCode":js}}

def supa_rpc(nid, name, x, y, rpc_name, body_expr):
    return {
        "id": nid, "name": name,
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.1, "position": [x, y],
        "parameters": {
            "method": "POST",
            "url": SUPA_URL + "/rest/v1/rpc/" + rpc_name,
            "sendHeaders": True,
            "headerParameters": {"parameters": SUPA_HEADERS},
            "sendBody": True, "specifyBody": "json",
            "jsonBody": body_expr,
            "options": {}
        }
    }

def groq_node():
    system_prompt = (
        "Voce classifica mensagens de WhatsApp de clientes de uma assistencia tecnica de celulares e notebooks em Braganca Paulista. "
        "Retorne APENAS JSON valido, sem markdown, sem texto extra.\\n\\n"
        "Campos obrigatorios:\\n"
        "- intent: \\\"lead\\\" | \\\"consulta_status\\\" | \\\"saudacao\\\" | \\\"orcamento\\\" | \\\"atendente\\\" | \\\"outro\\\"\\n"
        "- device: modelo do aparelho mencionado ou null\\n"
        "- problem: descricao resumida do problema ou null\\n"
        "- urgency: \\\"alta\\\" | \\\"media\\\" | \\\"baixa\\\" | null\\n\\n"
        "Regras:\\n"
        "- \\\"lead\\\": cliente descreve problema ou quer conserto\\n"
        "- \\\"consulta_status\\\": quer saber status/andamento do reparo\\n"
        "- \\\"orcamento\\\": quer saber preco sem descrever problema especifico\\n"
        "- \\\"atendente\\\": quer falar com pessoa humana\\n"
        "- \\\"saudacao\\\": apenas cumprimento\\n"
        "- \\\"outro\\\": nao se encaixa em nenhuma categoria\\n\\n"
        "Exemplos:\\n"
        "{\\\"intent\\\":\\\"lead\\\",\\\"device\\\":\\\"iPhone 13\\\",\\\"problem\\\":\\\"tela quebrada\\\",\\\"urgency\\\":\\\"alta\\\"}\\n"
        "{\\\"intent\\\":\\\"consulta_status\\\",\\\"device\\\":null,\\\"problem\\\":null,\\\"urgency\\\":null}\\n"
        "{\\\"intent\\\":\\\"saudacao\\\",\\\"device\\\":null,\\\"problem\\\":null,\\\"urgency\\\":null}"
    )
    return {
        "id": "n-groq", "name": "Classificar Intencao",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.1, "position": [700, 580],
        "parameters": {
            "method": "POST",
            "url": "https://api.groq.com/openai/v1/chat/completions",
            "sendHeaders": True,
            "headerParameters": {"parameters": [
                {"name": "Authorization", "value": "Bearer " + GROQ_KEY},
                {"name": "Content-Type",  "value": "application/json"},
            ]},
            "sendBody": True, "specifyBody": "json",
            "jsonBody": json.dumps({
                "model": "llama-3.3-70b-versatile",
                "temperature": 0.1,
                "max_tokens": 200,
                "stream": False,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": "={{ $('Parse Event').first().json.messageText }}"},
                ]
            }),
            "options": {}
        }
    }

def upsert_lead_node():
    return {
        "id": "n-ul", "name": "Upsert Lead",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.1, "position": [1120, 580],
        "onError": "continueRegularOutput",
        "parameters": {
            "method": "POST",
            "url": SUPA_URL + "/rest/v1/rpc/upsert_whatsapp_lead",
            "sendHeaders": True,
            "headerParameters": {"parameters": SUPA_HEADERS},
            "sendBody": True, "specifyBody": "json",
            "jsonBody": '={"p_whatsapp":"{{ $json.phone }}","p_name":"{{ $json.pushName }}","p_service_category":"{{ $json.aiDevice ? $json.aiDevice : \'WhatsApp\' }}","p_source":"WhatsApp Bot"}',
            "options": {}
        }
    }

# ── Nodes ──────────────────────────────────────────────────────────────────────
nodes = [
    # 1. Trigger
    {"id":"n-wh","name":"Webhook ICC","type":"n8n-nodes-base.webhook",
     "typeVersion":1,"position":[0,400],
     "webhookId":"icc-webhook",
     "parameters":{"httpMethod":"POST","path":"icc-webhook","options":{}}},

    # 2. Parse da mensagem (sem keyword matching)
    code_node("n-parse","Parse Event", 220, 400, PARSE_JS),

    # 3. IF: é notificação interna de reparo?
    {"id":"n-if","name":"E Reparo?",
     "type":"n8n-nodes-base.if","typeVersion":2,"position":[460,400],
     "parameters":{
         "conditions":{
             "options":{"caseSensitive":True,"leftValue":"","typeValidation":"loose"},
             "conditions":[{
                 "id":"repair-check",
                 "leftValue":"={{ $json.intent }}",
                 "rightValue":"supabase_repair",
                 "operator":{"type":"string","operation":"equals"}
             }],
             "combinator":"and"
         },
         "options":{}
     }},

    # Ramo TRUE — notificação interna de reparo
    code_node("n-fn", "Formatar Notificacao", 700, 200, FMT_NOTIF_JS),
    send_node("n-sn", "Enviar Notificacao WA", 920, 200),

    # Ramo FALSE — mensagem de cliente
    # 4. Groq: classifica intenção
    groq_node(),

    # 5. Parse resultado da IA
    code_node("n-pia", "Parse IA", 920, 580, PARSE_IA_JS),

    # 6. Upsert lead (enriquecido com device da IA)
    upsert_lead_node(),

    # 7. Restaura dados do Parse IA após upsert
    code_node("n-pt", "Restaurar Dados", 1340, 580, PASSTHROUGH_JS),

    # 8. Switch de intent (baseado na IA)
    {"id":"n-sw","name":"Switch Intent","type":"n8n-nodes-base.switch",
     "typeVersion":3,"position":[1560,580],
     "parameters":{
         "mode":"rules","fallbackOutput":4,"options":{},
         "rules":{"values":[
             {"conditions":{"conditions":[{"leftValue":"={{ $json.intent }}","operator":{"type":"string","operation":"equals"},"rightValue":"consulta_status"}],"combinator":"and"},"output":0},
             {"conditions":{"conditions":[{"leftValue":"={{ $json.intent }}","operator":{"type":"string","operation":"equals"},"rightValue":"orcamento"}],"combinator":"and"},"output":1},
             {"conditions":{"conditions":[{"leftValue":"={{ $json.intent }}","operator":{"type":"string","operation":"equals"},"rightValue":"atendente"}],"combinator":"and"},"output":2},
             {"conditions":{"conditions":[{"leftValue":"={{ $json.intent }}","operator":{"type":"string","operation":"equals"},"rightValue":"lead"}],"combinator":"and"},"output":3},
         ]}}},

    # Branch 0 — Consulta de status via RPC
    supa_rpc("n-cs", "Consultar Status", 1800, 200,
             "get_repair_status_by_whatsapp",
             '={"p_whatsapp":"{{ $json.phone }}"}'),
    code_node("n-fs", "Formatar Status", 2020, 200, FMT_STATUS_JS),
    send_node("n-ss", "Enviar Status WA", 2240, 200),

    # Branch 1 — Orçamento
    code_node("n-oc", "Msg Orcamento", 1800, 420, ORC_JS),
    send_node("n-so", "Enviar Orcamento WA", 2020, 420),

    # Branch 2 — Atendente
    code_node("n-ac", "Msg Atendente", 1800, 580, ATEND_JS),
    send_node("n-sa", "Enviar Atendente WA", 2020, 580),

    # Branch 3 — Lead reconhecido (welcome com dados da IA)
    # Branch 4 (fallback) — Saudação / outro
    code_node("n-wc", "Boas-vindas", 1800, 740, WELCOME_JS),
    send_node("n-sw2","Enviar Boas-vindas WA", 2020, 740),
]

connections = {
    "Webhook ICC":         {"main":[[{"node":"Parse Event",          "type":"main","index":0}]]},
    "Parse Event":         {"main":[[{"node":"E Reparo?",            "type":"main","index":0}]]},
    "E Reparo?":           {"main":[
        [{"node":"Formatar Notificacao",  "type":"main","index":0}],  # output 0 = true
        [{"node":"Classificar Intencao", "type":"main","index":0}],  # output 1 = false
    ]},
    "Formatar Notificacao": {"main":[[{"node":"Enviar Notificacao WA","type":"main","index":0}]]},
    "Classificar Intencao": {"main":[[{"node":"Parse IA",            "type":"main","index":0}]]},
    "Parse IA":             {"main":[[{"node":"Upsert Lead",          "type":"main","index":0}]]},
    "Upsert Lead":          {"main":[[{"node":"Restaurar Dados",      "type":"main","index":0}]]},
    "Restaurar Dados":      {"main":[[{"node":"Switch Intent",        "type":"main","index":0}]]},
    "Switch Intent":        {"main":[
        [{"node":"Consultar Status",   "type":"main","index":0}],  # 0 consulta_status
        [{"node":"Msg Orcamento",      "type":"main","index":0}],  # 1 orcamento
        [{"node":"Msg Atendente",      "type":"main","index":0}],  # 2 atendente
        [{"node":"Boas-vindas",        "type":"main","index":0}],  # 3 lead
        [{"node":"Boas-vindas",        "type":"main","index":0}],  # 4 fallback (saudacao/outro)
    ]},
    "Consultar Status":    {"main":[[{"node":"Formatar Status",      "type":"main","index":0}]]},
    "Formatar Status":     {"main":[[{"node":"Enviar Status WA",     "type":"main","index":0}]]},
    "Msg Orcamento":       {"main":[[{"node":"Enviar Orcamento WA",  "type":"main","index":0}]]},
    "Msg Atendente":       {"main":[[{"node":"Enviar Atendente WA",  "type":"main","index":0}]]},
    "Boas-vindas":         {"main":[[{"node":"Enviar Boas-vindas WA","type":"main","index":0}]]},
}

workflow = {
    "name": "Automacao ICC - IA + Status",
    "nodes": nodes,
    "connections": connections,
    "active": False,
    "settings": {"executionOrder": "v1"}
}

s, r, _ = req("POST", "/rest/workflows", workflow, cookie=jwt)
wf_id = r.get("data",{}).get("id")
print(f"\nWorkflow criado: {s} | id={wf_id} | name={r.get('data',{}).get('name')}")
if r.get("message"): print(f"  erro: {r.get('message')}")

if wf_id:
    s, r, _ = req("PATCH", f"/rest/workflows/{wf_id}", {"active":True}, cookie=jwt)
    print(f"Ativacao: {s} | active={r.get('data',{}).get('active')}")
