const { io } = require("socket.io-client");

const TOKEN_CLIENT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwibm9tIjoiRGlvcCIsInByZW5vbSI6IkF3YSIsImVtYWlsIjoiY2xpZW50QHRlc3Quc24iLCJyb2xlIjoiY2xpZW50IiwiaWF0IjoxNzg2MDQ0MzU0LCJleHAiOjE3ODYxMzA3NTQsImlzcyI6InNlbmVnYWwtY29ubmVjdCJ9.JIFpGJN2eoKNpS1b0rKDRyMLTR0DI_x-R0tSjTTiKFk";
const TOKEN_AGENT  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Miwibm9tIjoiRmFsbCIsInByZW5vbSI6Ik1vdXNzYSIsImVtYWlsIjoiYWdlbnRAdGVzdC5zbiIsInJvbGUiOiJhZ2VudCIsImlhdCI6MTc4NjA0NDM2NSwiZXhwIjoxNzg2MTMwNzY1LCJpc3MiOiJzZW5lZ2FsLWNvbm5lY3QifQ.0mAZCeGpAFrtKGzO9hiUqXdUJUvWGa20vG-FEyuHNPw";
const TICKET_ID = 1; // le ticket créé à l'étape 6

function connecter(nom, token) {
  const socket = io("http://localhost:3000", { auth: { token } });

  socket.on("connect", () => {
    console.log(`[${nom}] connecté, socket.id=${socket.id}`);
    socket.emit("join_room", { ticket_id: TICKET_ID });
  });

  socket.on("connect_error", (err) => {
    console.log(`[${nom}] ERREUR de connexion :`, err.message);
  });

  socket.on("receive_message", (msg) => {
    console.log(`[${nom}] message reçu :`, JSON.stringify(msg, null, 2));
  });

  socket.on("error_message", (err) => {
    console.log(`[${nom}] erreur serveur :`, err);
  });

  return socket;
}

const client = connecter("CLIENT", TOKEN_CLIENT);
const agent  = connecter("AGENT", TOKEN_AGENT);

// Après 1.5s, le client envoie un message
setTimeout(() => {
  console.log("\n--- Le CLIENT envoie un message ---\n");
  client.emit("send_message", { ticket_id: TICKET_ID, contenu: "Bonjour, ma facture est fausse" });
}, 1500);

// Après 3s, l'agent répond
setTimeout(() => {
  console.log("\n--- L'AGENT répond ---\n");
  agent.emit("send_message", { ticket_id: TICKET_ID, contenu: "Bonjour, je regarde ça tout de suite" });
}, 3000);

// Après 4.5s, test avec un token invalide
setTimeout(() => {
  console.log("\n--- Test avec un token invalide ---\n");
  connecter("INTRUS", "token_invalide_123");
}, 4500);

// Fin du test après 6s
setTimeout(() => {
  console.log("\n--- Fin du test ---\n");
  process.exit(0);
}, 6000);
