import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  query,
  where,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';

// IMPORTANT: These global variables are provided by the canvas environment.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = (() => {
  try {
    return typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
  } catch (e) {
    return {};
  }
})();
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// The main App component
const App = () => {
  const [page, setPage] = useState('invitor');
  const [invitationData, setInvitationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [invitorData, setInvitorData] = useState(null);
  const [guests, setGuests] = useState([]);
  const [error, setError] = useState('');

  // Firebase initialization and authentication
  useEffect(() => {
    try {
      if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
        setError("Firebase Initialization Error: Firebase configuration is missing.");
        setLoading(false);
        return;
      }

      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);
      setDb(firestore);
      setAuth(firebaseAuth);

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          setUserId(user.uid);
          setLoading(false);
        } else {
          try {
            if (initialAuthToken) {
              await signInWithCustomToken(firebaseAuth, initialAuthToken);
            } else {
              await signInAnonymously(firebaseAuth);
            }
          } catch (error) {
            console.error("Firebase Auth Error:", error);
            setError("Authentication failed. Please try again.");
            setLoading(false);
          }
        }
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Firebase Initialization Error:", e);
      setError("Firebase Initialization Error: Check your API key or configuration.");
      setLoading(false);
    }
  }, []);

  // Set up real-time listener for invitor data
  useEffect(() => {
    if (db && userId) {
      const invitorDocRef = doc(db, `/artifacts/${appId}/users/${userId}/invitations/${userId}`);
      const unsubscribe = onSnapshot(invitorDocRef, (doc) => {
        if (doc.exists()) {
          setInvitorData(doc.data());
        } else {
          setInvitorData(null);
        }
      });
      return () => unsubscribe();
    }
  }, [db, userId]);

  // Set up real-time listener for guests list
  useEffect(() => {
    if (db && invitorData) {
      const guestsCollectionRef = collection(db, `/artifacts/${appId}/users/${userId}/guests`);
      const q = query(guestsCollectionRef);
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const guestsList = [];
        querySnapshot.forEach((doc) => {
          guestsList.push({ id: doc.id, ...doc.data() });
        });
        setGuests(guestsList);
      });
      return () => unsubscribe();
    }
  }, [db, invitorData]);

  // Handle invitation link logic
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invitorId = params.get('invitorId');
    if (invitorId) {
      setPage('invitee');
      setLoading(true);

      const invitorDocRef = doc(db, `/artifacts/${appId}/users/${invitorId}/invitations/${invitorId}`);
      getDoc(invitorDocRef).then((doc) => {
        if (doc.exists()) {
          setInvitationData(doc.data());
        } else {
          setInvitationData(null);
        }
        setLoading(false);
      }).catch((e) => {
        console.error("Error fetching invitation:", e);
        setInvitationData(null);
        setLoading(false);
      });
    }
  }, [db]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="text-xl font-medium text-gray-700">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-red-100 text-red-800 p-4 rounded-lg shadow">
        <div className="text-lg text-center">{error}</div>
      </div>
    );
  }

  const PageContent = () => {
    if (page === 'invitor') {
      return <InvitorPage />;
    } else {
      return <InvitationPage />;
    }
  };

  const InvitorPage = () => {
    const [coupleName1, setCoupleName1] = useState(invitorData?.coupleName1 || '');
    const [coupleName2, setCoupleName2] = useState(invitorData?.coupleName2 || '');
    const [date, setDate] = useState(invitorData?.date || '');
    const [location, setLocation] = useState(invitorData?.location || '');
    const [guestName, setGuestName] = useState('');
    const [shareUrl, setShareUrl] = useState('');
    const [showInvitation, setShowInvitation] = useState(true);

    const handleSaveInvitation = async () => {
      if (!coupleName1 || !coupleName2 || !date || !location) {
        alert('Please fill in all fields.');
        return;
      }
      try {
        const invitorDocRef = doc(db, `/artifacts/${appId}/users/${userId}/invitations/${userId}`);
        await setDoc(invitorDocRef, {
          coupleName1,
          coupleName2,
          date,
          location,
          createdAt: serverTimestamp(),
        });

        const appUrl = window.location.href.split('?')[0];
        setShareUrl(`${appUrl}?invitorId=${userId}`);

      } catch (e) {
        console.error("Error adding document: ", e);
      }
    };

    const handleAddGuest = async () => {
      if (!guestName) return;
      try {
        const guestsCollectionRef = collection(db, `/artifacts/${appId}/users/${userId}/guests`);
        await addDoc(guestsCollectionRef, {
          name: guestName,
          status: "pending",
          createdAt: serverTimestamp(),
        });
        setGuestName('');
      } catch (e) {
        console.error("Error adding guest:", e);
      }
    };

    const handleShare = (guestId) => {
      const appUrl = window.location.href.split('?')[0];
      const link = `${appUrl}?invitorId=${userId}&guestId=${guestId}`;
      const message = `You're invited! Please click the link to RSVP: ${link}`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    };

    const getStatusCounts = () => {
      const counts = {
        coming: 0,
        declined: 0,
        pending: 0,
      };
      guests.forEach(guest => {
        if (counts[guest.status]) {
          counts[guest.status]++;
        } else {
          counts[guest.status] = 1;
        }
      });
      return counts;
    };

    const statusCounts = getStatusCounts();

    return (
      <div className="min-h-screen bg-gradient-to-r from-purple-500 to-indigo-600 flex flex-col items-center p-4 text-white">
        <div className="w-full max-w-xl text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2">Invitor Dashboard</h1>
          <p className="text-lg md:text-xl font-light opacity-80">Manage your guest list and send invitations.</p>
        </div>

        <div className="w-full max-w-xl bg-white bg-opacity-10 backdrop-blur-md rounded-xl shadow-2xl p-6 md:p-8 space-y-6">

          {/* Invitation Details Section */}
          <div className="bg-white bg-opacity-5 rounded-xl p-4 md:p-6 shadow-lg space-y-4">
            <h2 className="text-2xl font-bold mb-2">Create Your Invitation</h2>
            <input
              type="text"
              className="w-full p-3 rounded-lg bg-white bg-opacity-10 placeholder-gray-200 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
              placeholder="Your Name"
              value={coupleName1}
              onChange={(e) => setCoupleName1(e.target.value)}
            />
            <input
              type="text"
              className="w-full p-3 rounded-lg bg-white bg-opacity-10 placeholder-gray-200 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
              placeholder="Partner's Name"
              value={coupleName2}
              onChange={(e) => setCoupleName2(e.target.value)}
            />
            <input
              type="text"
              className="w-full p-3 rounded-lg bg-white bg-opacity-10 placeholder-gray-200 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
              placeholder="Date (e.g., May 20, 2026)"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <input
              type="text"
              className="w-full p-3 rounded-lg bg-white bg-opacity-10 placeholder-gray-200 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
              placeholder="Location (e.g., The Grand Ballroom)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <button
              onClick={handleSaveInvitation}
              className="w-full p-3 rounded-lg font-bold text-white bg-indigo-500 hover:bg-indigo-700 transition transform hover:scale-105"
            >
              Save Invitation
            </button>
          </div>

          {/* Guest List Management */}
          <div className="bg-white bg-opacity-5 rounded-xl p-4 md:p-6 shadow-lg space-y-4">
            <h2 className="text-2xl font-bold mb-2">Guest List</h2>
            <div className="flex space-x-2 mb-4 text-sm">
              <span className="p-2 rounded-lg bg-green-500 font-semibold">Coming: {statusCounts.coming}</span>
              <span className="p-2 rounded-lg bg-red-500 font-semibold">Can't Come: {statusCounts.declined}</span>
              <span className="p-2 rounded-lg bg-gray-500 font-semibold">Pending: {statusCounts.pending}</span>
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                className="flex-grow p-3 rounded-lg bg-white bg-opacity-10 placeholder-gray-200 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                placeholder="Enter guest name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddGuest()}
              />
              <button
                onClick={handleAddGuest}
                className="p-3 rounded-lg font-bold text-white bg-indigo-500 hover:bg-indigo-700 transition transform hover:scale-105"
              >
                Add
              </button>
            </div>
            <ul className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
              {guests.map((guest) => (
                <li key={guest.id} className="flex items-center justify-between p-3 bg-white bg-opacity-5 rounded-lg shadow-inner">
                  <div className="flex-grow">
                    <span className="font-semibold">{guest.name}</span>
                    <span className={`ml-2 text-sm font-medium ${guest.status === 'coming' ? 'text-green-300' : guest.status === 'declined' ? 'text-red-300' : 'text-gray-300'}`}>
                      - {guest.status}
                    </span>
                  </div>
                  <button
                    onClick={() => handleShare(guest.id)}
                    className="ml-4 p-2 rounded-lg text-xs font-semibold text-white bg-indigo-500 hover:bg-indigo-700 transition transform hover:scale-105"
                  >
                    Share
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Invitation Link Section */}
          {shareUrl && (
            <div className="bg-white bg-opacity-5 rounded-xl p-4 md:p-6 shadow-lg space-y-4 text-center">
              <h2 className="text-2xl font-bold mb-2">Share Your Invitation Link</h2>
              <div className="p-3 rounded-lg bg-gray-900 bg-opacity-30 break-all text-sm">
                {shareUrl}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(shareUrl)}
                className="w-full p-3 rounded-lg font-bold text-white bg-green-500 hover:bg-green-700 transition transform hover:scale-105"
              >
                Copy Link
              </button>
            </div>
          )}

        </div>
      </div>
    );
  };

  const InvitationPage = () => {
    const [guestName, setGuestName] = useState('');
    const [status, setStatus] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleRsvp = async (newStatus) => {
      const params = new URLSearchParams(window.location.search);
      const invitorId = params.get('invitorId');
      const guestId = params.get('guestId');

      if (!guestId || !invitorId) {
        alert("This invitation link is invalid.");
        return;
      }

      if (!guestName) {
        alert("Please enter your name.");
        return;
      }

      try {
        const guestDocRef = doc(db, `/artifacts/${appId}/users/${invitorId}/guests/${guestId}`);
        await setDoc(guestDocRef, { name: guestName, status: newStatus }, { merge: true });
        setStatus(newStatus);
        setIsSubmitted(true);
      } catch (e) {
        console.error("Error updating RSVP:", e);
      }
    };

    if (!invitationData) {
      return (
        <div className="min-h-screen flex justify-center items-center bg-gray-100 text-red-600">
          Invitation not found.
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center p-4 text-white">
        <div className="w-full max-w-2xl bg-white bg-opacity-10 backdrop-blur-md rounded-xl shadow-2xl p-6 md:p-10 space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">You're Invited!</h1>
            <p className="text-lg md:text-xl font-light opacity-80">Join us in celebration of love and new beginnings.</p>
          </div>

          <div className="bg-white bg-opacity-5 rounded-xl p-6 md:p-8 shadow-lg space-y-4">
            <div className="text-3xl md:text-4xl font-bold">
              {invitationData.coupleName1} &amp; {invitationData.coupleName2}
            </div>
            <div className="text-md md:text-lg font-light opacity-90">
              {invitationData.date}
            </div>
            <div className="text-lg md:text-xl font-medium">
              {invitationData.location}
            </div>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              className="w-full p-3 rounded-lg bg-white bg-opacity-10 placeholder-gray-200 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 transition text-center"
              placeholder="Your Full Name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
            />
            {!isSubmitted ? (
              <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
                <button
                  onClick={() => handleRsvp('coming')}
                  className="w-full p-4 rounded-lg font-bold text-white bg-green-600 hover:bg-green-700 transition transform hover:scale-105 shadow-md"
                >
                  Coming
                </button>
                <button
                  onClick={() => handleRsvp('declined')}
                  className="w-full p-4 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 transition transform hover:scale-105 shadow-md"
                >
                  Can't Come
                </button>
                <button
                  onClick={() => handleRsvp('pending')}
                  className="w-full p-4 rounded-lg font-bold text-white bg-gray-600 hover:bg-gray-700 transition transform hover:scale-105 shadow-md"
                >
                  I'll Try
                </button>
              </div>
            ) : (
              <div className={`p-4 rounded-lg font-bold text-white ${status === 'coming' ? 'bg-green-600' : status === 'declined' ? 'bg-red-600' : 'bg-gray-600'} transition shadow-md`}>
                Thank you for your response!
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return <PageContent />;
};

export default App;
