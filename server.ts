import socketio from "socket.io";
import express from "express";
import * as http from "http";
import { PlayerData } from "./types";
import { Impl, InternalState } from "./functions-impl";

const app = express();
const server = http.createServer(app);
const io = socketio(http);

const impl = new Impl();
const users: Map<string, PlayerData> = new Map();
const states: Map<string, InternalState> = new Map();
const connections: Map<string, Set<SocketIO.Socket>> = new Map();

function addConnection(stateId: string, socket: socketio.Socket) {
  if (!connections.has(stateId)) {
    connections.set(stateId, new Set([socket]));
  } else {
    connections.get(stateId)!.add(socket);
  }
}

function deleteConnection(stateId: string, socket: SocketIO.Socket) {
  connections.get(stateId)!.delete(socket);
  if (connections.get(stateId)!.size === 0) {
    connections.delete(stateId);
  }
}

function broadcastUpdates(stateId: string, state: InternalState) {
  connections.get(stateId)!.forEach(socket => {
    const userId = socket.handshake.query.userId;
    const userData = users.get(userId)!;
    const userState = impl.getUserState(state, userData);
    socket.emit("state", userState);
  });
}

app.use(express.json());
app.post("/register", (req, res) => {
  const userData: PlayerData = req.body;
  const userId = Math.random()
    .toString(36)
    .substring(2);
  users.set(userId, userData);
  res.send();
});
app.post("/new", (req, res) => {
  const userId = req.query.userId;
  const userData = users.get(userId)!;
  const state = impl.createGame(userData);
  const stateId = Math.random()
    .toString(36)
    .substring(2);
  states.set(stateId, state);
  res.json({ stateId });
});

io.on("connection", socket => {
  const stateId = socket.handshake.query.stateId;
  const userId = socket.handshake.query.userId;
  const state = states.get(stateId)!;
  const userData = users.get(userId)!;
  addConnection(stateId, socket);
  socket.on("disconnect", () => {
    deleteConnection(stateId, socket);
  });

  socket.on("joinGame", () => {
    impl.joinGame(state, userData);
    broadcastUpdates(stateId, state);
  });
  socket.on("startGame", (roleList, playerOrder) => {
    impl.startGame(state, userData, roleList, playerOrder);
    broadcastUpdates(stateId, state);
  });
  socket.on("proposeQuest", (questId, proposedMembers) => {
    impl.proposeQuest(state, userData, questId, proposedMembers);
    broadcastUpdates(stateId, state);
  });
  socket.on("voteForProposal", (questId, vote) => {
    impl.voteForProposal(state, userData, questId, vote);
    broadcastUpdates(stateId, state);
  });
  socket.on("voteInQuest", (questId, vote) => {
    impl.voteInQuest(state, userData, questId, vote);
    broadcastUpdates(stateId, state);
  });
});

server.listen(3000, () => {
  console.log("listening on *:3000");
});
