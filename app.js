// 🔥 Firebase imports
import { auth, db } from "./firebase.js";
import {
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// 🧱 DOM Elements
const notesList = document.getElementById("notes-list");
const logoutBtn = document.getElementById("logout-btn");
const alertBoxEl = document.getElementById("alert-box");
const saveStatus = document.getElementById("save-status");
const confirmDeleteModal = document.getElementById("confirm-delete-modal");

// 📦 Alert Box (unobtrusive)
function showMessage(message, type = "success", timeout = 3000) {
  if (!alertBoxEl) return;
  // clear any pending hide timer so new messages show immediately
  clearTimeout(alertBoxEl._hideTimeout);
  alertBoxEl.textContent = message;
  alertBoxEl.classList.remove('success', 'error');
  alertBoxEl.classList.add(type === 'success' ? 'success' : 'error');
  // trigger visible state (CSS handles transition)
  alertBoxEl.classList.add('visible');
  alertBoxEl._hideTimeout = setTimeout(() => {
    alertBoxEl.classList.remove('visible');
  }, timeout);
}

// 🌀 Loading Screen helpers (uses #loading-screen from CSS if present)
let loadingScreen = document.getElementById("loading-screen");
if (!loadingScreen) {
  loadingScreen = document.createElement("div");
  loadingScreen.id = "loading-screen";
  // use CSS-controlled #loading-screen; add inner text node with class
  loadingScreen.classList.add('loading-screen');
  const loadingInner = document.createElement('div');
  loadingInner.className = 'loading-inner';
  const spinner = document.createElement('div');
  spinner.className = 'spinner gold';
  const loadingText = document.createElement('div');
  loadingText.className = 'loading-text';
  loadingText.textContent = 'Loading...';
  loadingInner.appendChild(spinner);
  loadingInner.appendChild(loadingText);
  loadingScreen.appendChild(loadingInner);
  document.body.appendChild(loadingScreen);
}

// 🛑 Logout screen (created dynamically similar to loading screen)
let logoutScreen = document.getElementById('logout-screen');
if (!logoutScreen) {
  logoutScreen = document.createElement('div');
  logoutScreen.id = 'logout-screen';
  logoutScreen.classList.add('hidden');
  const loText = document.createElement('div');
  loText.className = 'logout-text';
  const loSpinner = document.createElement('div');
  loSpinner.className = 'spinner red';
  const loTextNode = document.createElement('div');
  loTextNode.textContent = 'Logging out...';
  loText.appendChild(loSpinner);
  loText.appendChild(loTextNode);
  logoutScreen.appendChild(loText);
  document.body.appendChild(logoutScreen);
}

function showLogoutScreen() {
  if (!logoutScreen) return;
  logoutScreen.classList.remove('hidden');
}

function hideLogoutScreen() {
  if (!logoutScreen) return;
  logoutScreen.classList.add('hidden');
}

function showLoading() {
  if (!loadingScreen) return;
  loadingScreen.classList.remove('hidden');
}

function hideLoading() {
  if (!loadingScreen) return;
  loadingScreen.classList.add('hidden');
}

// 🔐 Auth Guard with Safe Loading
onAuthStateChanged(auth, (user) => {
  if (user) {
    showLoading();
    fetchNotes(user.uid)
      .then(() => hideLoading())
      .catch((err) => {
        console.error("Error fetching notes:", err);
        showMessage("Failed to load notes.", "error");
        hideLoading();
      });
  } else {
    hideLoading();
    setTimeout(() => (window.location.href = "login.html"), 300);
  }

  // Safety: hide loading even if Firebase hangs
  setTimeout(hideLoading, 5000);
});

// 🧩 Rendered notes tracker
const renderedNotes = new Map();

// 📥 Fetch Notes
function fetchNotes(uid) {
  return new Promise((resolve, reject) => {
    try {
      const q = query(
        collection(db, "notes"),
        where("uid", "==", uid),
        orderBy("updatedAt", "desc")
      );

      onSnapshot(
        q,
        (snapshot) => {
          const newNotes = new Map();

          snapshot.forEach((docSnap) => {
            newNotes.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
          });

          // Remove deleted
          for (const id of renderedNotes.keys()) {
            if (!newNotes.has(id)) {
              const el = document.getElementById(`note-${id}`);
              if (el) notesList.removeChild(el);
              renderedNotes.delete(id);
            }
          }

          // Add/update
          let idx = 0;
          newNotes.forEach((note, id) => {
            if (!renderedNotes.has(id)) {
              const noteEl = renderNote(note);
              noteEl.id = `note-${id}`;
              notesList.insertBefore(noteEl, notesList.children[idx]);
              renderedNotes.set(id, noteEl);
            } else {
              const noteEl = renderedNotes.get(id);
              const textarea = noteEl.querySelector("textarea");
              if (
                !noteEl.classList.contains("editing") &&
                textarea.value !== note.content
              ) {
                textarea.value = note.content || "";
                setTimeout(() => autoResize.call(textarea), 0);
              }
            }
            idx++;
          });

          const emptyState = document.getElementById("empty-state");
          if (newNotes.size === 0) emptyState.style.display = "block";
          else emptyState.style.display = "none";

          resolve();
        },
        (error) => reject(error)
      );
    } catch (err) {
      reject(err);
    }
  });
}

// 🧠 Render Note
function renderNote(note) {
  const noteEl = document.createElement("div");
  noteEl.className = "note";

  const textarea = document.createElement("textarea");
  textarea.value = note.content || "";
  textarea.placeholder = "Type your note here...";
  textarea.rows = 1;
  textarea.readOnly = true;
  setTimeout(() => autoResize.call(textarea), 0);

  let originalContent = note.content || "";

  const editBtn = document.createElement("button");
  editBtn.textContent = "Edit";
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.display = "none";

  cancelBtn.onclick = () => {
    textarea.value = originalContent;
    textarea.readOnly = true;
    noteEl.classList.remove("editing");
    editBtn.textContent = "Edit";
    cancelBtn.style.display = "none";
    setSavingStatus(false);
    setTimeout(() => autoResize.call(textarea), 0);
  };

  editBtn.onclick = () => {
    if (noteEl.classList.contains("editing")) {
      textarea.readOnly = true;
      noteEl.classList.remove("editing");
      // Save only if content changed
      if (originalContent !== textarea.value) {
        originalContent = textarea.value;
        updateNote(note.id, textarea.value);
      }
      setSavingStatus(false);
      editBtn.textContent = "Edit";
      cancelBtn.style.display = "none";
    } else {
      textarea.readOnly = false;
      noteEl.classList.add("editing");
      textarea.focus();
      // move cursor to end
      textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
      editBtn.textContent = "Save";
      cancelBtn.style.display = "inline-block";
    }
  };

  textarea.addEventListener("input", autoResize);
  textarea.addEventListener("input", () => setSavingStatus(true));

  // keyboard support inside textarea: Esc to cancel, Mod+S to save
  textarea.addEventListener("keydown", (e) => {
    const isMod = e.ctrlKey || e.metaKey;
    if (e.key === "Escape") {
      cancelBtn.click();
      e.preventDefault();
    }
    if (isMod && e.key.toLowerCase() === "s") {
      if (noteEl.classList.contains("editing")) {
        editBtn.click();
        e.preventDefault();
      }
    }
  });

  const delBtn = document.createElement("button");
  delBtn.textContent = "Delete Note";
  delBtn.onclick = () => showDeleteModal(note.id);

  noteEl.append(textarea, editBtn, cancelBtn, delBtn);
  return noteEl;
}

// 🗑️ Delete Modal
let pendingDeleteId = null;
function showDeleteModal(noteId) {
  pendingDeleteId = noteId;
  confirmDeleteModal.innerHTML = `
    <div class="modal-content">
      <h3>Delete Note?</h3>
      <p>Are you sure you want to delete this note? This action cannot be undone.</p>
      <button id="confirm-delete-btn">Delete</button>
      <button id="cancel-delete-btn">Cancel</button>
    </div>
  `;
  // remove the hidden helper class so stylesheet can show the modal
  confirmDeleteModal.classList.remove('hidden');
  document.getElementById("confirm-delete-btn").onclick = () => {
    deleteNote(pendingDeleteId);
    hideDeleteModal();
  };
  document.getElementById("cancel-delete-btn").onclick = hideDeleteModal;
}

function hideDeleteModal() {
  // hide via helper class (CSS uses .hidden { display: none !important })
  confirmDeleteModal.classList.add('hidden');
  confirmDeleteModal.innerHTML = "";
  pendingDeleteId = null;
}

// 💾 Save status
let savingTimeout;
function setSavingStatus(isSaving) {
  if (isSaving) {
    const s = document.createElement('span');
    s.className = 'saving';
    s.textContent = 'Saving...';
    saveStatus.innerHTML = '';
    saveStatus.appendChild(s);
  } else {
    const s = document.createElement('span');
    s.className = 'saved';
    s.textContent = 'Saved ✓';
    saveStatus.innerHTML = '';
    saveStatus.appendChild(s);
    clearTimeout(savingTimeout);
    savingTimeout = setTimeout(() => (saveStatus.innerHTML = ""), 1500);
  }
}

function autoResize() {
  this.style.height = "auto";
  this.style.height = `${this.scrollHeight}px`;
}

// ➕ Create Note
async function createNote() {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await addDoc(collection(db, "notes"), {
      uid: user.uid,
      content: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    showMessage("Note created!");
    // after a short delay, focus the first editable empty note if present
    setTimeout(() => focusFirstEmptyNote(), 400);
  } catch (err) {
    console.error("Create error:", err.message);
    showMessage("Failed to create note.", "error");
  }
}

function focusFirstEmptyNote() {
  // Prefer the top-most note that is empty
  const noteEls = document.querySelectorAll('.note');
  for (const el of noteEls) {
    const ta = el.querySelector('textarea');
    if (!ta) continue;
    if (ta.value.trim() === '') {
      const editBtn = el.querySelector('button');
      if (editBtn) editBtn.click();
      ta.focus();
      ta.selectionStart = ta.selectionEnd = ta.value.length;
      return;
    }
  }
}

// Global keyboard shortcut: Shift+N for new note (avoids browser conflicts)
window.addEventListener('keydown', (e) => {
  if (!e.shiftKey) return;
  if (e.key.toLowerCase() === 'n') {
    // avoid overriding when typing in inputs/textareas
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
    createNote();
    e.preventDefault();
  }
});

// 📝 Update Note
async function updateNote(id, content) {
  try {
    await updateDoc(doc(db, "notes", id), {
      content,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Update error:", err.message);
    showMessage("Failed to update note.", "error");
  }
}

// ❌ Delete Note
async function deleteNote(id) {
  try {
    await deleteDoc(doc(db, "notes", id));
    showMessage("Note deleted.");
  } catch (err) {
    console.error("Delete error:", err.message);
    showMessage("Failed to delete note.", "error");
  }
}

// 🚪 Logout
logoutBtn.addEventListener("click", async () => {
  try {
    // show the logout screen while signOut is in progress
    showLogoutScreen();
    await signOut(auth);
    showMessage("Logged out.");
    // on success, auth state will redirect to login.html (handled elsewhere)
  } catch (err) {
    console.error("Logout error:", err.message);
    hideLogoutScreen();
    showMessage("Logout failed.", "error");
  }
});

// 🔘 HTML Hook
window.createNote = createNote;
