const { io } = require("socket.io-client");

const TOKEN_CLIENT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwibm9tIjoiRGlvcCIsInByZW5vbSI6IkF3YSIsImVtYWlsIjoiY2xpZW50QHRlc3Quc24iLCJyb2xlIjoiY2xpZW50IiwiaWF0IjoxNzg2MTk0NTcyLCJleHAiOjE3ODYyODA5NzIsImlzcyI6InNlbmVnYWwtY29ubmVjdCJ9.LLWbb4WeBDbwdb3Zi1-Gx8tU0iGBU7wsDebriPDXWDs";
const TOKEN_AGENT  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Miwibm9tIjoiRmFsbCIsInByZW5vbSI6Ik1vdXNzYSIsImVtYWlsIjoiYWdlbnRAdGVzdC5zbiIsInJvbGUiOiJhZ2VudCIsImlhdCI6MTc4NjE5NDU4MywiZXhwIjoxNzg2MjgwOTgzLCJpc3MiOiJzZW5lZ2FsLWNvbm5lY3QifQ.QDcvg8S7NHNo4H73M-yk4VtDkfG1MxgAVMTsaeo7-Jg";
const TICKET_ID = 1;

function connecter(nom, token) {
  const socket = io("http://localhost:3000", { auth: { token } });

  socket.on("connect", () => {
    console.log(`[${nom}] connecté, socket.id=${socket.id}`);
  });

  socket.on("connect_error", (err) => {
    console.log(`[${nom}] ERREUR connexion :`, err.message);
  });

  socket.on("ticket:assigne_ok", (data) => {
    console.log(`[${nom}] ✅ ticket:assigne_ok :`, data);
  });

  socket.on("appel:entrant", (data) => {
    console.log(`[${nom}] 📞 appel:entrant reçu :`, data);
  });

  socket.on("appel:initie_ok", (data) => {
    console.log(`[${nom}] ✅ appel:initie_ok :`, data);
  });

  socket.on("appel:accepte", (data) => {
    console.log(`[${nom}] ✅ appel:accepte reçu (peerId distant) :`, data);
  });

  socket.on("appel:refuse", (data) => {
    console.log(`[${nom}] ❌ appel:refuse :`, data);
  });

  socket.on("appel:termine", (data) => {
    console.log(`[${nom}] 🔚 appel:termine :`, data);
  });

  socket.on("appel:erreur", (err) => {
    console.log(`[${nom}] ⚠️ appel:erreur :`, err);
  });

  socket.on("appel:controle", (data) => {
    console.log(`[${nom}] 🎛️ appel:controle reçu :`, data);
  });

  return socket;
}

const client = connecter("CLIENT", TOKEN_CLIENT);
const agent  = connecter("AGENT", TOKEN_AGENT);

let appelIdCapture = null;
agent.on("appel:entrant", (data) => {
  appelIdCapture = data.appelId;
});

setTimeout(() => {
  console.log("\n--- L'AGENT s'assigne le ticket (pour passer en_cours) ---\n");
  agent.emit("ticket:assigner", { ticket_id: TICKET_ID });
}, 1000);

setTimeout(() => {
  console.log("\n--- Le CLIENT initie un appel vidéo ---\n");
  client.emit("appel:initier", {
    ticketId: TICKET_ID,
    type: "video",
    peerId: "peer-simule-client-abc123"
  });
}, 2500);

setTimeout(() => {
  console.log("\n--- L'AGENT accepte l'appel ---\n");
  agent.emit("appel:accepter", {
    appelId: appelIdCapture,
    peerId: "peer-simule-agent-xyz789"
  });
}, 4000);

setTimeout(() => {
  console.log("\n--- Le CLIENT coupe son micro (test appel:controle) ---\n");
  client.emit("join_room", { ticket_id: TICKET_ID });
  agent.emit("join_room", { ticket_id: TICKET_ID });
  client.emit("appel:controle", {
    ticketId: TICKET_ID,
    micro: false,
    video: true,
    partageEcran: false
  });
}, 5500);

setTimeout(() => {
  console.log("\n--- Fin de l'appel ---\n");
  client.emit("appel:terminer", {
    appelId: appelIdCapture,
    dureeSecondes: 42
  });
}, 6500);

setTimeout(() => {
  console.log("\n--- Fin du test ---\n");
  process.exit(0);
}, 8000);

