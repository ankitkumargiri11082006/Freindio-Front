import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import "./App.css";

type User = {
  _id?: string;
  id?: string;
  name: string;
  userId: string;
  profilePhoto?: string;
  caption?: string;
  unreadCount?: number;
};

type Message = {
  _id: string;
  sender: string;
  receiver: string;
  text: string;
  imageUrl: string;
  createdAt: string;
};

const normalizeApiUrl = (rawUrl: string | undefined) => {
  const fallbackUrl = "http://localhost:5000/api";
  const value = (rawUrl || fallbackUrl).trim().replace(/\/+$/, "");

  if (/\/api$/i.test(value)) {
    return value;
  }

  return `${value}/api`;
};

const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL);
const APP_NAME = "Talk Loop";
const NOTIFICATION_APP_NAME = "TalkNow";
const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "U";

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
  const [signupCaption, setSignupCaption] = useState("");
  const [authError, setAuthError] = useState("");

  const [contacts, setContacts] = useState<User[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [chatError, setChatError] = useState("");
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 900);
  const [showMobileContacts, setShowMobileContacts] = useState(true);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberResults, setMemberResults] = useState<User[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileCaption, setProfileCaption] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const unreadCountByUserRef = useRef<Record<string, number>>({});
  const unreadInitializedRef = useRef(false);
  const filteredContacts = useMemo(() => {
    const term = contactSearch.trim().toLowerCase();
    if (!term) return contacts;

    return contacts.filter((contact) => {
      const contactName = (contact.name || "").toLowerCase();
      const contactUserId = (contact.userId || "").toLowerCase();
      return contactName.includes(term) || contactUserId.includes(term);
    });
  }, [contacts, contactSearch]);
  const canSend = Boolean(text.trim() || image);

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
          : {
              name: name.trim(),
              userId: userId.trim(),
              password,
              caption: signupCaption.trim().slice(0, 120),
            };

      const response = await axios.post(`${API_URL}${endpoint}`, payload);
      const loggedInUser: User = response.data.user;

      setToken(response.data.token);
      setCurrentUser(loggedInUser);
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(loggedInUser));

      setName("");
      setUserId("");
      setPassword("");
      setSignupCaption("");
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          setAuthError("Cannot reach backend. Check VITE_API_URL and backend CORS CLIENT_URL.");
        } else {
          setAuthError(error.response.data?.message || "Authentication failed");
        }
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
    setProfileName("");
    setProfileCaption("");
    setProfilePhoto(null);
    setProfileMessage("");
    setIsEditingProfile(false);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  const updateProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;

    const trimmedName = profileName.trim();
    if (!trimmedName) {
      setProfileMessage("Name is required");
      return;
    }

    try {
      setProfileSaving(true);
      setProfileMessage("");

      const formData = new FormData();
      formData.append("name", trimmedName);
      formData.append("caption", profileCaption.trim().slice(0, 120));
      if (profilePhoto) {
        formData.append("profilePhoto", profilePhoto);
      }

      const response = await axios.put(`${API_URL}/users/profile`, formData, {
        headers: {
          ...authHeaders,
          "Content-Type": "multipart/form-data",
        },
      });

      const updatedUser: User = response.data.user;
      setCurrentUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));

      setContacts((prev) =>
        prev.map((contact) => {
          const id = contact._id || contact.id;
          const updatedId = updatedUser._id || updatedUser.id;
          if (id !== updatedId) return contact;
          return {
            ...contact,
            name: updatedUser.name,
            profilePhoto: updatedUser.profilePhoto,
            caption: updatedUser.caption,
          };
        })
      );

      if (selectedContact) {
        const selectedId = selectedContact._id || selectedContact.id;
        const updatedId = updatedUser._id || updatedUser.id;
        if (selectedId === updatedId) {
          setSelectedContact((prev) =>
            prev
              ? {
                  ...prev,
                  name: updatedUser.name,
                  profilePhoto: updatedUser.profilePhoto,
                  caption: updatedUser.caption,
                }
              : prev
          );
        }
      }

      setProfilePhoto(null);
      setProfileMessage("Profile updated successfully");
      setIsEditingProfile(false);
    } catch {
      setProfileMessage("Unable to update profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const fetchContacts = async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API_URL}/users/chats`, {
        headers: authHeaders,
      });
      const users: User[] = response.data.users || [];
      setContacts(users);

      const nextUnreadMap: Record<string, number> = {};
      const activeContactId = selectedContact?._id || selectedContact?.id;

      users.forEach((user) => {
        const id = user._id || user.id;
        if (!id) return;

        const nextUnread = user.unreadCount || 0;
        nextUnreadMap[id] = nextUnread;

        const previousUnread = unreadCountByUserRef.current[id] || 0;
        const shouldNotify =
          unreadInitializedRef.current &&
          nextUnread > previousUnread &&
          id !== activeContactId &&
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted";

        if (shouldNotify) {
          const title = `${user.name} sent a message from ${NOTIFICATION_APP_NAME}`;
          new Notification(title);
        }
      });

      unreadCountByUserRef.current = nextUnreadMap;
      unreadInitializedRef.current = true;
    } catch {
      setChatError("Unable to load recent chats");
    }
  };

  const fetchMessages = async (contactId: string) => {
    if (!token) return;
    try {
      const response = await axios.get(`${API_URL}/messages/${contactId}`, {
        headers: authHeaders,
      });
      setMessages(response.data.messages || []);
      fetchContacts();
    } catch {
      setChatError("Unable to load messages");
    }
  };

  const fetchMemberResults = async (searchTerm: string) => {
    if (!token) return;

    try {
      setMemberLoading(true);
      const response = await axios.get(`${API_URL}/users/contacts`, {
        headers: authHeaders,
        params: { search: searchTerm.trim() },
      });
      setMemberResults(response.data.users || []);
    } catch {
      setChatError("Unable to search members");
    } finally {
      setMemberLoading(false);
    }
  };

  const openAddMember = async () => {
    setIsAddMemberOpen(true);
    setMemberSearch("");
    await fetchMemberResults("");
  };

  const selectContactAndOpenChat = (contact: User) => {
    const selectedId = contact._id || contact.id;
    if (!selectedId) return;

    setContacts((prev) => {
      const alreadyExists = prev.some((item) => (item._id || item.id) === selectedId);
      if (alreadyExists) return prev;
      return [contact, ...prev];
    });

    setSelectedContact(contact);
    if (isMobile) {
      setShowMobileContacts(false);
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
      fetchContacts();
    } catch {
      setChatError("Unable to send message");
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => fetchContacts(), 4000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!selectedContact) return;
    const contactId = selectedContact._id || selectedContact.id;
    if (!contactId) return;

    fetchMessages(contactId);
    const interval = setInterval(() => fetchMessages(contactId), 3000);
    return () => clearInterval(interval);
  }, [selectedContact, token]);

  useEffect(() => {
    const handleResize = () => {
      const nextIsMobile = window.innerWidth <= 900;
      setIsMobile(nextIsMobile);
      if (!nextIsMobile) {
        setShowMobileContacts(true);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isAddMemberOpen) return;
    const timer = setTimeout(() => {
      fetchMemberResults(memberSearch);
    }, 280);

    return () => clearTimeout(timer);
  }, [memberSearch, isAddMemberOpen]);

  useEffect(() => {
    if (!currentUser) return;
    setProfileName(currentUser.name || "");
    setProfileCaption(currentUser.caption || "");
  }, [currentUser]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const alreadyAsked = sessionStorage.getItem("talkloop_notification_asked") === "yes";
    if (alreadyAsked) return;

    sessionStorage.setItem("talkloop_notification_asked", "yes");
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  if (!token || !currentUser) {
    return (
      <main className="auth-page">
        <form className="auth-card" onSubmit={handleAuth}>
          <div className="brand">
            <img src="/logo.png" alt="Talk Loop logo" />
            <div className="brand-copy">
              <h1>{APP_NAME}</h1>
              <small>✨ Fast, colorful, and private conversations.</small>
            </div>
          </div>
          <p>{mode === "login" ? "🔐 Login to continue" : "🎉 Create your account"}</p>

          {mode === "signup" && (
            <>
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                required
              />
              <input
                type="text"
                placeholder="📝 Add a short caption (optional)"
                value={signupCaption}
                onChange={(event) => setSignupCaption(event.target.value)}
                maxLength={120}
              />
            </>
          )}

          <input
            type="text"
            placeholder="User ID"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            autoComplete="username"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />

          {authError && <span className="error">{authError}</span>}

          <button type="submit">{mode === "login" ? "🚀 Login" : "✅ Sign Up"}</button>
          <button
            type="button"
            className="secondary"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "🆕 Need an account? Sign up" : "👋 Already have an account? Login"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="chat-page">
      <aside className={`sidebar ${isMobile && !showMobileContacts ? "mobile-hidden" : ""}`}>
        <div className="brand sidebar-brand">
          <img src="/logo.png" alt="Talk Loop logo" />
          <span>💬 {APP_NAME}</span>
        </div>

        <div className="profile">
          <div className="profile-top">
            {currentUser.profilePhoto ? (
              <img src={currentUser.profilePhoto} alt={currentUser.name} className="avatar-img" />
            ) : (
              <span className="avatar">{getInitials(currentUser.name)}</span>
            )}
            <div>
              <strong>{currentUser.name}</strong>
              <small>🆔 @{currentUser.userId}</small>
              {currentUser.caption && <small className="caption">“{currentUser.caption}”</small>}
            </div>
          </div>

          <div className="profile-top-actions">
            <button
              type="button"
              onClick={() => {
                if (isEditingProfile) {
                  setIsEditingProfile(false);
                  setProfilePhoto(null);
                  setProfileMessage("");
                  setProfileName(currentUser.name || "");
                  setProfileCaption(currentUser.caption || "");
                  return;
                }

                setIsEditingProfile(true);
              }}
            >
              {isEditingProfile ? "❌ Close" : "✏️ Edit Details"}
            </button>
            <button type="button" className="profile-logout" onClick={logout}>🚪 Logout</button>
          </div>

          {isEditingProfile && (
            <form className="profile-editor" onSubmit={updateProfile}>
              <input
                type="text"
                placeholder="Name"
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                required
              />
              <input
                type="text"
                placeholder="📝 Caption"
                value={profileCaption}
                onChange={(event) => setProfileCaption(event.target.value)}
                maxLength={120}
              />
              <input
                className="upload-input"
                type="file"
                accept="image/*"
                onChange={(event) => setProfilePhoto(event.target.files?.[0] || null)}
              />
              <div className="profile-actions">
                <button type="submit" disabled={profileSaving}>
                  {profileSaving ? "Saving..." : "💾 Save Profile"}
                </button>
                <button
                  type="button"
                  className="profile-cancel"
                  onClick={() => {
                    setIsEditingProfile(false);
                    setProfilePhoto(null);
                    setProfileMessage("");
                    setProfileName(currentUser.name || "");
                    setProfileCaption(currentUser.caption || "");
                  }}
                >
                  Cancel
                </button>
              </div>
              {profileMessage && <small className="caption">{profileMessage}</small>}
            </form>
          )}
        </div>

        <input
          className="search"
          type="text"
          placeholder="🔎 Search contacts by user ID"
          value={contactSearch}
          onChange={(event) => setContactSearch(event.target.value)}
        />

        <button type="button" className="add-member-btn" onClick={openAddMember}>
          ➕ Add Member
        </button>

        <div className="contacts">
          {filteredContacts.length === 0 ? (
            <div className="empty-contacts">
              {contactSearch.trim()
                ? "No matching chats found. Use + Add Member to start a new chat."
                : "No chats yet. Use + Add Member to start chatting."}
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const id = contact._id || contact.id;
              return (
                <button
                  key={id}
                  className={`contact-item ${selectedContact && (selectedContact._id || selectedContact.id) === id ? "active" : ""}`}
                  onClick={() => selectContactAndOpenChat(contact)}
                >
                  <div className="contact-main">
                    {contact.profilePhoto ? (
                      <img src={contact.profilePhoto} alt={contact.name} className="avatar-img" />
                    ) : (
                      <span className="avatar">{getInitials(contact.name)}</span>
                    )}
                    <div className="contact-info">
                      <strong>👤 {contact.name}</strong>
                      <small>🆔 @{contact.userId}</small>
                      {contact.caption && <small className="caption">{contact.caption}</small>}
                    </div>
                    {!!contact.unreadCount && contact.unreadCount > 0 && (
                      <span className="unread-badge" title={`${contact.unreadCount} pending messages`}>
                        {contact.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className={`chat-box ${isMobile && showMobileContacts ? "mobile-hidden" : ""}`}>
        {selectedContact ? (
          <>
            <header className="chat-header">
              {isMobile && (
                <button
                  type="button"
                  className="back-btn"
                  onClick={() => setShowMobileContacts(true)}
                >
                  ←
                </button>
              )}
              <div className="contact-main">
                {selectedContact.profilePhoto ? (
                  <img src={selectedContact.profilePhoto} alt={selectedContact.name} className="avatar-img" />
                ) : (
                  <span className="avatar">{getInitials(selectedContact.name)}</span>
                )}
                <div>
                  <h2>💬 {selectedContact.name}</h2>
                  <small>🆔 @{selectedContact.userId}</small>
                  {selectedContact.caption && <small className="caption">{selectedContact.caption}</small>}
                </div>
              </div>
            </header>

            <div className="messages">
              {messages.map((message) => {
                const mine = message.sender === (currentUser._id || currentUser.id);
                return (
                  <div key={message._id} className={`msg ${mine ? "mine" : "other"}`}>
                    <small className="msg-owner">{mine ? "🟢 You" : "🟣 Contact"}</small>
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
              <div className="composer-row">
                <input
                  type="text"
                  placeholder="✍️ Type message"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                />
                <input
                  id="chat-image-input"
                  className="chat-upload-input"
                  type="file"
                  accept="image/*"
                  onChange={(event) => setImage(event.target.files?.[0] || null)}
                />
                <label htmlFor="chat-image-input" className="pin-btn" title="Attach image">
                  📎
                </label>
                <button className="send-btn-corner" type="submit" disabled={!canSend}>📨</button>
              </div>
              <small className="send-meta">
                {image ? `🖼️ Attached: ${image.name}` : "💡 Tip: You can send text, image, or both."}
              </small>
            </form>
            {chatError && <span className="error">{chatError}</span>}
          </>
        ) : (
          <div className="placeholder">🌈 Select a contact to start chatting.</div>
        )}
      </section>

      {isAddMemberOpen && (
        <div className="member-modal-overlay" onClick={() => setIsAddMemberOpen(false)}>
          <div className="member-modal" onClick={(event) => event.stopPropagation()}>
            <div className="member-modal-head">
              <h3>👥 Add Member</h3>
              <button type="button" className="close-btn" onClick={() => setIsAddMemberOpen(false)}>
                ✕
              </button>
            </div>

            <input
              type="text"
              placeholder="🔎 Search by user ID"
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
            />

            <div className="member-list">
              {memberLoading ? (
                <div className="member-empty">Searching members...</div>
              ) : memberResults.length === 0 ? (
                <div className="member-empty">No users found.</div>
              ) : (
                memberResults.map((member) => {
                  const id = member._id || member.id;
                  return (
                    <button
                      key={id}
                      type="button"
                      className="member-item"
                      onClick={() => {
                        selectContactAndOpenChat(member);
                        setIsAddMemberOpen(false);
                      }}
                    >
                      <div className="contact-main">
                        {member.profilePhoto ? (
                          <img src={member.profilePhoto} alt={member.name} className="avatar-img" />
                        ) : (
                          <span className="avatar">{getInitials(member.name)}</span>
                        )}
                        <div>
                          <strong>👤 {member.name}</strong>
                          <small>🆔 @{member.userId}</small>
                          {member.caption && <small className="caption">{member.caption}</small>}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
