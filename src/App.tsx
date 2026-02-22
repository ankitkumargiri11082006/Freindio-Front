import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import "./App.css";

type User = {
  _id?: string;
  id?: string;
  name: string;
  userId: string;
};

type Message = {
  _id: string;
  sender: string;
  receiver: string;
  text: string;
  imageUrl: string;
  createdAt: string;
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function App() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [contacts, setContacts] = useState<User[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [chatError, setChatError] = useState("");

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  const handleAuth = async (event: FormEvent) => {
    event.preventDefault();
    setAuthError("");

    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/signup";
      const payload =
        mode === "login"
          ? { userId: userId.trim(), password }
          : { name: name.trim(), userId: userId.trim(), password };

      const response = await axios.post(`${API_URL}${endpoint}`, payload);
      const loggedInUser: User = response.data.user;

      setToken(response.data.token);
      setCurrentUser(loggedInUser);
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(loggedInUser));

      setName("");
      setUserId("");
      setPassword("");
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setAuthError(error.response?.data?.message || "Authentication failed");
      } else {
        setAuthError("Authentication failed");
      }
    }
  };

  const logout = () => {
    setToken("");
    setCurrentUser(null);
    setContacts([]);
    setMessages([]);
    setSelectedContact(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  const fetchContacts = async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API_URL}/users/contacts`, {
        headers: authHeaders,
        params: { search: contactSearch.trim() },
      });
      setContacts(response.data.users || []);
    } catch {
      setChatError("Unable to load contacts");
    }
  };

  const fetchMessages = async (contactId: string) => {
    if (!token) return;
    try {
      const response = await axios.get(`${API_URL}/messages/${contactId}`, {
        headers: authHeaders,
      });
      setMessages(response.data.messages || []);
    } catch {
      setChatError("Unable to load messages");
    }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedContact) return;
    if (!text.trim() && !image) return;

    try {
      const formData = new FormData();
      formData.append("text", text.trim());
      if (image) formData.append("image", image);

      await axios.post(`${API_URL}/messages/${selectedContact._id || selectedContact.id}`, formData, {
        headers: {
          ...authHeaders,
          "Content-Type": "multipart/form-data",
        },
      });

      setText("");
      setImage(null);
      await fetchMessages(selectedContact._id || selectedContact.id || "");
    } catch {
      setChatError("Unable to send message");
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchContacts();
    }, 350);

    return () => clearTimeout(timer);
  }, [contactSearch]);

  useEffect(() => {
    if (!selectedContact) return;
    const contactId = selectedContact._id || selectedContact.id;
    if (!contactId) return;

    fetchMessages(contactId);
    const interval = setInterval(() => fetchMessages(contactId), 3000);
    return () => clearInterval(interval);
  }, [selectedContact, token]);

  if (!token || !currentUser) {
    return (
      <main className="auth-page">
        <form className="auth-card" onSubmit={handleAuth}>
          <h1>Simple Chat App</h1>
          <p>{mode === "login" ? "Login to continue" : "Create your account"}</p>

          {mode === "signup" && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          )}

          <input
            type="text"
            placeholder="User ID"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {authError && <span className="error">{authError}</span>}

          <button type="submit">{mode === "login" ? "Login" : "Sign Up"}</button>
          <button
            type="button"
            className="secondary"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Need an account? Sign up" : "Already have an account? Login"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="chat-page">
      <aside className="sidebar">
        <div className="profile">
          <strong>{currentUser.name}</strong>
          <small>@{currentUser.userId}</small>
          <button onClick={logout}>Logout</button>
        </div>

        <input
          className="search"
          type="text"
          placeholder="Search by user ID"
          value={contactSearch}
          onChange={(event) => setContactSearch(event.target.value)}
        />

        <div className="contacts">
          {contacts.map((contact) => {
            const id = contact._id || contact.id;
            return (
              <button
                key={id}
                className={`contact-item ${selectedContact && (selectedContact._id || selectedContact.id) === id ? "active" : ""}`}
                onClick={() => setSelectedContact(contact)}
              >
                <strong>{contact.name}</strong>
                <small>@{contact.userId}</small>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="chat-box">
        {selectedContact ? (
          <>
            <header>
              <h2>{selectedContact.name}</h2>
              <small>@{selectedContact.userId}</small>
            </header>

            <div className="messages">
              {messages.map((message) => {
                const mine = message.sender === (currentUser._id || currentUser.id);
                return (
                  <div key={message._id} className={`msg ${mine ? "mine" : "other"}`}>
                    {message.text && <p>{message.text}</p>}
                    {message.imageUrl && (
                      <a href={message.imageUrl} target="_blank" rel="noreferrer">
                        <img src={message.imageUrl} alt="message" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>

            <form className="send-box" onSubmit={sendMessage}>
              <input
                type="text"
                placeholder="Type message"
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setImage(event.target.files?.[0] || null)}
              />
              <button type="submit">Send</button>
            </form>
            {chatError && <span className="error">{chatError}</span>}
          </>
        ) : (
          <div className="placeholder">Select a contact to start chatting.</div>
        )}
      </section>
    </main>
  );
}

export default App;
