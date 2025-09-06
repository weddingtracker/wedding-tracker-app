import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

// Global variables provided by the canvas environment
const __app_id = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const __firebase_config = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const __initial_auth_token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let app, auth, db;
try {
    if (__firebase_config) {
        app = initializeApp(__firebase_config);
        auth = getAuth(app);
        db = getFirestore(app);
        
    } else {
        throw new Error("Firebase configuration is not available.");
    }
} catch (e) {
    console.error("Firebase Initialization Error:", e);
}

const App = () => {
    const [page, setPage] = useState('invitor');
    const [invitationData, setInvitationData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!auth || !db) {
            setError("App failed to start. Firebase may not be configured.");
            setLoading(false);
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const invitationId = urlParams.get('invitationId');

        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                try {
                    if (__initial_auth_token) {
                        await signInWithCustomToken(auth, __initial_auth_token);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (e) {
                    console.error("Auth failed:", e);
                    setError("Failed to start the app. Please try again.");
                    setLoading(false);
                    return;
                }
            }
            const currentUserId = auth.currentUser?.uid || crypto.randomUUID();
            setUserId(currentUserId);

            if (invitationId) {
                setPage('invitee');
                const invitationRef = doc(db, 'artifacts', __app_id, 'public', 'data', 'invitations', invitationId);
                const unsubscribe = onSnapshot(invitationRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setInvitationData(docSnap.data());
                    } else {
                        setError("Invitation not found. It may have been deleted.");
                    }
                    setLoading(false);
                }, (err) => {
                    console.error("Error fetching invitation:", err);
                    setError("Failed to load invitation. Please check your link.");
                    setLoading(false);
                });
                return () => unsubscribe();
            } else {
                setPage('invitor');
                const invitorRef = doc(db, 'artifacts', __app_id, 'users', currentUserId, 'invitorData', 'main');
                const unsubscribe = onSnapshot(invitorRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setInvitationData(docSnap.data());
                    } else {
                        setInvitationData(null);
                    }
                    setLoading(false);
                }, (err) => {
                    console.error("Error fetching invitor data:", err);
                    setError("Failed to load your data. Please refresh.");
                    setLoading(false);
                });
                return () => unsubscribe();
            }
        });
    }, []);

    const handleCreateInvitation = async (event) => {
        event.preventDefault();
        setLoading(true);
        const invitorName = event.target.invitorName.value;
        const partnerName = event.target.partnerName.value;
        const date = event.target.date.value;
        const time = event.target.time.value;
        const location = event.target.location.value;
        
        const invitorRef = doc(db, 'artifacts', __app_id, 'users', userId, 'invitorData', 'main');
        const invitationRef = doc(db, 'artifacts', __app_id, 'public', 'data', 'invitations', userId);

        const newInvitationData = {
            invitorName,
            partnerName,
            date,
            time,
            location,
            invitationId: userId,
            invitees: [],
        };

        try {
            await setDoc(invitorRef, newInvitationData);
            await setDoc(invitationRef, newInvitationData);
            setLoading(false);
        } catch (e) {
            console.error("Error writing document: ", e);
            setError("Failed to save invitation. Please check your network.");
            setLoading(false);
        }
    };

    const handleRsvp = async (e) => {
        e.preventDefault();
        const inviteeName = e.target.inviteeName.value;
        const rsvpStatus = e.target.rsvpStatus.value;
        const invitationId = new URLSearchParams(window.location.search).get('invitationId');
        
        const invitationRef = doc(db, 'artifacts', __app_id, 'public', 'data', 'invitations', invitationId);
        const docSnap = await getDoc(invitationRef);
        const currentInvitees = docSnap.data().invitees || [];
        
        if (!currentInvitees.some(guest => guest.name === inviteeName)) {
            const updatedInvitees = [...currentInvitees, { name: inviteeName, status: rsvpStatus }];
            await setDoc(invitationRef, { invitees: updatedInvitees }, { merge: true });
        } else {
            const updatedInvitees = currentInvitees.map(guest => 
                guest.name === inviteeName ? { ...guest, status: rsvpStatus } : guest
            );
            await setDoc(invitationRef, { invitees: updatedInvitees }, { merge: true });
        }
        
        const rsvpModal = document.getElementById('rsvp-success-modal');
        if (rsvpModal) rsvpModal.classList.remove('hidden');
    };

    const InvitationPage = () => {
        if (loading) return (
            <div className="flex justify-center items-center h-screen bg-gray-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading Invitation...</p>
                </div>
            </div>
        );
        if (error) return (
            <div className="flex justify-center items-center h-screen bg-gray-100">
                <p className="text-red-500 text-center">{error}</p>
            </div>
        );
        if (!invitationData) return null;

        return (
            <div className="flex flex-col items-center p-6 min-h-screen">
                <div className="w-full max-w-lg bg-white rounded-xl shadow-lg p-6 my-auto text-center">
                    <h1 className="text-4xl font-extrabold text-indigo-600 mb-2">You're Invited!</h1>
                    <p className="text-lg text-gray-700 mb-6">Join us as we celebrate our love.</p>
                    <div className="space-y-4">
                        <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-xl font-semibold text-gray-800">{invitationData.invitorName} & {invitationData.partnerName}</p>
                            <p className="text-gray-500 text-sm">{invitationData.date} at {invitationData.time}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-lg font-semibold text-gray-800">{invitationData.location}</p>
                        </div>
                    </div>
                    
                    <form onSubmit={handleRsvp} className="mt-8 space-y-4">
                        <input type="text" name="inviteeName" required placeholder="Your Full Name" className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                        <div className="flex flex-col space-y-2 text-left">
                            <div className="flex items-center space-x-2">
                                <input type="radio" id="coming" name="rsvpStatus" value="Coming" required className="form-radio text-indigo-600 focus:ring-indigo-500"/>
                                <label htmlFor="coming" className="text-gray-700">Coming</label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <input type="radio" id="not-coming" name="rsvpStatus" value="Can't Make It" required className="form-radio text-indigo-600 focus:ring-indigo-500"/>
                                <label htmlFor="not-coming" className="text-gray-700">Sorry, can't make it</label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <input type="radio" id="try" name="rsvpStatus" value="Will Try" required className="form-radio text-indigo-600 focus:ring-indigo-500"/>
                                <label htmlFor="try" className="text-gray-700">I will try</label>
                            </div>
                        </div>
                        <button type="submit" className="w-full bg-indigo-500 text-white font-bold py-3 px-8 rounded-full hover:bg-indigo-600 transition duration-300 transform hover:scale-105">Submit RSVP</button>
                    </form>
                    
                    <a href="/" className="block mt-6 text-indigo-500 hover:underline">Create your own invitation!</a>
                </div>
                
                <div id="rsvp-success-modal" className="modal hidden">
                    <div className="modal-content">
                        <h3 className="text-xl font-bold mb-4 text-green-600">Thank you for your response!</h3>
                        <button onClick={() => document.getElementById('rsvp-success-modal').classList.add('hidden')} className="mt-6 bg-indigo-500 text-white font-bold py-3 px-8 rounded-full hover:bg-indigo-600 transition duration-300">Close</button>
                    </div>
                </div>
            </div>
        );
    };

    const InvitorPage = () => {
        const shareUrl = `${window.location.origin}${window.location.pathname}?invitationId=${userId}`;
        
        const handleShare = (platform) => {
            const message = encodeURIComponent(`You're invited to our wedding! RSVP here: ${shareUrl}`);
            if (platform === 'whatsapp') {
                window.open(`https://wa.me/?text=${message}`, '_blank');
            } else if (platform === 'email') {
                window.open(`mailto:?subject=You're Invited&body=${message}`, '_blank');
            }
        };

        const rsvpCounts = {
            'Coming': invitationData?.invitees?.filter(i => i.status === 'Coming').length || 0,
            'Can\'t Make It': invitationData?.invitees?.filter(i => i.status === 'Can\'t Make It').length || 0,
            'Will Try': invitationData?.invitees?.filter(i => i.status === 'Will Try').length || 0,
            'Total Guests': invitationData?.invitees?.length || 0
        };

        return (
            <div className="flex flex-col items-center p-6 min-h-screen">
                <div className="w-full max-w-lg bg-white rounded-xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-2xl font-bold text-gray-800">Your Dashboard</h1>
                        <span className="text-sm text-gray-400">ID: {userId}</span>
                    </div>

                    {invitationData ? (
                        <div>
                            <div className="bg-gray-100 p-4 rounded-lg">
                                <h2 className="text-xl font-semibold mb-2">Invitation Details</h2>
                                <p><strong>Couple:</strong> {invitationData.invitorName} & {invitationData.partnerName}</p>
                                <p><strong>Date:</strong> {invitationData.date}</p>
                                <p><strong>Time:</strong> {invitationData.time}</p>
                                <p><strong>Location:</strong> {invitationData.location}</p>
                            </div>

                            <div className="mt-6 text-center">
                                <h2 className="text-xl font-semibold mb-2">Share Your Invitation</h2>
                                <p className="text-sm text-gray-500 mb-4">Your guests can use this link to RSVP.</p>
                                <div className="flex justify-center space-x-2">
                                    <button onClick={() => navigator.clipboard.writeText(shareUrl).then(() => {
                                        const shareBtn = document.getElementById('copy-btn');
                                        shareBtn.textContent = 'Copied!';
                                        setTimeout(() => shareBtn.textContent = 'Copy Link', 2000);
                                    })} id="copy-btn" className="bg-gray-200 text-gray-800 font-bold py-3 px-6 rounded-full hover:bg-gray-300 transition duration-300">Copy Link</button>
                                    <button onClick={() => handleShare('whatsapp')} className="bg-green-500 text-white font-bold py-3 px-6 rounded-full hover:bg-green-600 transition duration-300">WhatsApp</button>
                                    <button onClick={() => handleShare('email')} className="bg-blue-500 text-white font-bold py-3 px-6 rounded-full hover:bg-blue-600 transition duration-300">Email</button>
                                </div>
                            </div>
                            
                            <div className="mt-8">
                                <h2 className="text-xl font-semibold mb-2">RSVP Tracker</h2>
                                <div className="grid grid-cols-2 gap-4 text-center">
                                    <div className="bg-green-100 text-green-700 p-4 rounded-lg font-bold">
                                        <div className="text-2xl">{rsvpCounts['Coming']}</div>
                                        <div className="text-xs">Coming</div>
                                    </div>
                                    <div className="bg-red-100 text-red-700 p-4 rounded-lg font-bold">
                                        <div className="text-2xl">{rsvpCounts['Can\'t Make It']}</div>
                                        <div className="text-xs">Can't Make It</div>
                                    </div>
                                    <div className="bg-yellow-100 text-yellow-700 p-4 rounded-lg font-bold">
                                        <div className="text-2xl">{rsvpCounts['Will Try']}</div>
                                        <div className="text-xs">I Will Try</div>
                                    </div>
                                    <div className="bg-gray-100 text-gray-700 p-4 rounded-lg font-bold">
                                        <div className="text-2xl">{rsvpCounts['Total Guests']}</div>
                                        <div className="text-xs">Total Guests</div>
                                    </div>
                                </div>
                                
                                <h3 className="text-lg font-semibold mt-6 mb-2">Guest List</h3>
                                <ul className="space-y-2">
                                    {invitationData.invitees.length > 0 ? (
                                        invitationData.invitees.map((invitee, index) => (
                                            <li key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg shadow-sm">
                                                <span>{invitee.name}</span>
                                                <span className={`text-sm font-semibold py-1 px-3 rounded-full ${
                                                    invitee.status === 'Coming' ? 'bg-green-200 text-green-700' :
                                                    invitee.status === 'Can\'t Make It' ? 'bg-red-200 text-red-700' :
                                                    'bg-yellow-200 text-yellow-700'
                                                }`}>
                                                    {invitee.status}
                                                </span>
                                            </li>
                                        ))
                                    ) : (
                                        <li className="text-center text-gray-500 py-4">No responses yet.</li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleCreateInvitation} className="space-y-4">
                            <h2 className="text-xl font-semibold text-center text-gray-800">Create Your Invitation</h2>
                            <input type="text" name="invitorName" required placeholder="Your Name" className="w-full p-3 border border-gray-300 rounded-lg"/>
                            <input type="text" name="partnerName" required placeholder="Partner's Name" className="w-full p-3 border border-gray-300 rounded-lg"/>
                            <input type="date" name="date" required className="w-full p-3 border border-gray-300 rounded-lg"/>
                            <input type="time" name="time" required className="w-full p-3 border border-gray-300 rounded-lg"/>
                            <input type="text" name="location" required placeholder="Location" className="w-full p-3 border border-gray-300 rounded-lg"/>
                            <button type="submit" className="w-full bg-indigo-500 text-white font-bold py-3 px-8 rounded-full hover:bg-indigo-600 transition duration-300">Create</button>
                        </form>
                    )}
                </div>
            </div>
        );
    };

    const InvitationPage = () => {
        const handleRsvp = async (e) => {
            e.preventDefault();
            const inviteeName = e.target.inviteeName.value;
            const rsvpStatus = e.target.rsvpStatus.value;
            const invitationId = new URLSearchParams(window.location.search).get('invitationId');
            
            const invitationRef = doc(db, 'artifacts', __app_id, 'public', 'data', 'invitations', invitationId);
            const docSnap = await getDoc(invitationRef);
            const currentInvitees = docSnap.data().invitees || [];
            
            if (!currentInvitees.some(guest => guest.name === inviteeName)) {
                const updatedInvitees = [...currentInvitees, { name: inviteeName, status: rsvpStatus }];
                await setDoc(invitationRef, { invitees: updatedInvitees }, { merge: true });
            } else {
                const updatedInvitees = currentInvitees.map(guest => 
                    guest.name === inviteeName ? { ...guest, status: rsvpStatus } : guest
                );
                await setDoc(invitationRef, { invitees: updatedInvitees }, { merge: true });
            }
            
            const rsvpModal = document.getElementById('rsvp-success-modal');
            if (rsvpModal) rsvpModal.classList.remove('hidden');
        };

        const rsvpModalHtml = `
            <div id="rsvp-success-modal" className="modal hidden">
                <div className="modal-content">
                    <h3 className="text-xl font-bold mb-4 text-green-600">Thank you for your response!</h3>
                    <a href="/" className="block mt-4 text-indigo-500 hover:underline">Create your own invitation!</a>
                </div>
            </div>
        `;

        return (
            <div className="flex flex-col items-center p-6 min-h-screen">
                <div className="w-full max-w-lg bg-white rounded-xl shadow-lg p-6 my-auto text-center">
                    <h1 className="text-4xl font-extrabold text-indigo-600 mb-2">You're Invited!</h1>
                    <p className="text-lg text-gray-700 mb-6">Join us as we celebrate our love.</p>
                    <div className="space-y-4">
                        <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-xl font-semibold text-gray-800">{invitationData.invitorName} & {invitationData.partnerName}</p>
                            <p className="text-gray-500 text-sm">{invitationData.date} at {invitationData.time}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-lg font-semibold text-gray-800">{invitationData.location}</p>
                        </div>
                    </div>
                    
                    <form onSubmit={handleRsvp} className="mt-8 space-y-4">
                        <input type="text" name="inviteeName" required placeholder="Your Full Name" className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                        <div className="flex flex-col space-y-2 text-left">
                            <div className="flex items-center space-x-2">
                                <input type="radio" id="coming" name="rsvpStatus" value="Coming" required className="form-radio text-indigo-600 focus:ring-indigo-500"/>
                                <label htmlFor="coming" className="text-gray-700">Coming</label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <input type="radio" id="not-coming" name="rsvpStatus" value="Can't Make It" required className="form-radio text-indigo-600 focus:ring-indigo-500"/>
                                <label htmlFor="not-coming" className="text-gray-700">Sorry, can't make it</label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <input type="radio" id="try" name="rsvpStatus" value="Will Try" required className="form-radio text-indigo-600 focus:ring-indigo-500"/>
                                <label htmlFor="try" className="text-gray-700">I will try</label>
                            </div>
                        </div>
                        <button type="submit" className="w-full bg-indigo-500 text-white font-bold py-3 px-8 rounded-full hover:bg-indigo-600 transition duration-300 transform hover:scale-105">Submit RSVP</button>
                    </form>
                    
                    <a href="/" className="block mt-6 text-indigo-500 hover:underline">Create your own invitation!</a>
                </div>
                
                <div id="rsvp-success-modal" className="modal hidden">
                    <div className="modal-content">
                        <h3 className="text-xl font-bold mb-4 text-green-600">Thank you for your response!</h3>
                        <button onClick={() => document.getElementById('rsvp-success-modal').classList.add('hidden')} className="mt-6 bg-indigo-500 text-white font-bold py-3 px-8 rounded-full hover:bg-indigo-600 transition duration-300">Close</button>
                    </div>
                </div>
            </div>
        );
    };

    const InvitorPage = () => {
        const shareUrl = `${window.location.origin}${window.location.pathname}?invitationId=${userId}`;
        
        const handleShare = (platform) => {
            const message = encodeURIComponent(`You're invited to our wedding! RSVP here: ${shareUrl}`);
            if (platform === 'whatsapp') {
                window.open(`https://wa.me/?text=${message}`, '_blank');
            } else if (platform === 'email') {
                window.open(`mailto:?subject=You're Invited&body=${message}`, '_blank');
            }
        };

        const rsvpCounts = {
            'Coming': invitationData?.invitees?.filter(i => i.status === 'Coming').length || 0,
            'Can\'t Make It': invitationData?.invitees?.filter(i => i.status === 'Can\'t Make It').length || 0,
            'Will Try': invitationData?.invitees?.filter(i => i.status === 'Will Try').length || 0,
            'Total Guests': invitationData?.invitees?.length || 0
        };

        return (
            <div className="flex flex-col items-center p-6 min-h-screen">
                <div className="w-full max-w-lg bg-white rounded-xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-2xl font-bold text-gray-800">Your Dashboard</h1>
                        <span className="text-sm text-gray-400">ID: {userId}</span>
                    </div>

                    {invitationData ? (
                        <div>
                            <div className="bg-gray-100 p-4 rounded-lg">
                                <h2 className="text-xl font-semibold mb-2">Invitation Details</h2>
                                <p><strong>Couple:</strong> {invitationData.invitorName} & {invitationData.partnerName}</p>
                                <p><strong>Date:</strong> {invitationData.date}</p>
                                <p><strong>Time:</strong> {invitationData.time}</p>
                                <p><strong>Location:</strong> {invitationData.location}</p>
                            </div>

                            <div className="mt-6 text-center">
                                <h2 className="text-xl font-semibold mb-2">Share Your Invitation</h2>
                                <p className="text-sm text-gray-500 mb-4">Your guests can use this link to RSVP.</p>
                                <div className="flex justify-center space-x-2">
                                    <button onClick={() => navigator.clipboard.writeText(shareUrl).then(() => {
                                        const shareBtn = document.getElementById('copy-btn');
                                        shareBtn.textContent = 'Copied!';
                                        setTimeout(() => shareBtn.textContent = 'Copy Link', 2000);
                                    })} id="copy-btn" className="bg-gray-200 text-gray-800 font-bold py-3 px-6 rounded-full hover:bg-gray-300 transition duration-300">Copy Link</button>
                                    <button onClick={() => handleShare('whatsapp')} className="bg-green-500 text-white font-bold py-3 px-6 rounded-full hover:bg-green-600 transition duration-300">WhatsApp</button>
                                    <button onClick={() => handleShare('email')} className="bg-blue-500 text-white font-bold py-3 px-6 rounded-full hover:bg-blue-600 transition duration-300">Email</button>
                                </div>
                            </div>
                            
                            <div className="mt-8">
                                <h2 className="text-xl font-semibold mb-2">RSVP Tracker</h2>
                                <div className="grid grid-cols-2 gap-4 text-center">
                                    <div className="bg-green-100 text-green-700 p-4 rounded-lg font-bold">
                                        <div className="text-2xl">{rsvpCounts['Coming']}</div>
                                        <div className="text-xs">Coming</div>
                                    </div>
                                    <div className="bg-red-100 text-red-700 p-4 rounded-lg font-bold">
                                        <div className="text-2xl">{rsvpCounts['Can\'t Make It']}</div>
                                        <div className="text-xs">Can't Make It</div>
                                    </div>
                                    <div className="bg-yellow-100 text-yellow-700 p-4 rounded-lg font-bold">
                                        <div className="text-2xl">{rsvpCounts['Will Try']}</div>
                                        <div className="text-xs">I Will Try</div>
                                    </div>
                                    <div className="bg-gray-100 text-gray-700 p-4 rounded-lg font-bold">
                                        <div className="text-2xl">{rsvpCounts['Total Guests']}</div>
                                        <div className="text-xs">Total Guests</div>
                                    </div>
                                </div>
                                
                                <h3 className="text-lg font-semibold mt-6 mb-2">Guest List</h3>
                                <ul className="space-y-2">
                                    {invitationData.invitees.length > 0 ? (
                                        invitationData.invitees.map((invitee, index) => (
                                            <li key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg shadow-sm">
                                                <span>{invitee.name}</span>
                                                <span className={`text-sm font-semibold py-1 px-3 rounded-full ${
                                                    invitee.status === 'Coming' ? 'bg-green-200 text-green-700' :
                                                    invitee.status === 'Can\'t Make It' ? 'bg-red-200 text-red-700' :
                                                    'bg-yellow-200 text-yellow-700'
                                                }`}>
                                                    {invitee.status}
                                                </span>
                                            </li>
                                        ))
                                    ) : (
                                        <li className="text-center text-gray-500 py-4">No responses yet.</li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleCreateInvitation} className="space-y-4">
                            <h2 className="text-xl font-semibold text-center text-gray-800">Create Your Invitation</h2>
                            <input type="text" name="invitorName" required placeholder="Your Name" className="w-full p-3 border border-gray-300 rounded-lg"/>
                            <input type="text" name="partnerName" required placeholder="Partner's Name" className="w-full p-3 border border-gray-300 rounded-lg"/>
                            <input type="date" name="date" required className="w-full p-3 border border-gray-300 rounded-lg"/>
                            <input type="time" name="time" required className="w-full p-3 border border-gray-300 rounded-lg"/>
                            <input type="text" name="location" required placeholder="Location" className="w-full p-3 border border-gray-300 rounded-lg"/>
                            <button type="submit" className="w-full bg-indigo-500 text-white font-bold py-3 px-8 rounded-full hover:bg-indigo-600 transition duration-300">Create</button>
                        </form>
                    )}
                </div>
            </div>
        );
    };

    const InvitationPage = () => {
        const handleRsvp = async (e) => {
            e.preventDefault();
            const inviteeName = e.target.inviteeName.value;
            const rsvpStatus = e.target.rsvpStatus.value;
            const invitationId = new URLSearchParams(window.location.search).get('invitationId');
            
            const invitationRef = doc(db, 'artifacts', __app_id, 'public', 'data', 'invitations', invitationId);
            const docSnap = await getDoc(invitationRef);
            const currentInvitees = docSnap.data().invitees || [];
            
            if (!currentInvitees.some(guest => guest.name === inviteeName)) {
                const updatedInvitees = [...currentInvitees, { name: inviteeName, status: rsvpStatus }];
                await setDoc(invitationRef, { invitees: updatedInvitees }, { merge: true });
            } else {
                const updatedInvitees = currentInvitees.map(guest => 
                    guest.name === inviteeName ? { ...guest, status: rsvpStatus } : guest
                );
                await setDoc(invitationRef, { invitees: updatedInvitees }, { merge: true });
            }
            
            const rsvpModal = document.getElementById('rsvp-success-modal');
            if (rsvpModal) rsvpModal.classList.remove('hidden');
        };

        const rsvpModalHtml = `
            <div id="rsvp-success-modal" className="modal hidden">
                <div className="modal-content">
                    <h3 className="text-xl font-bold mb-4 text-green-600">Thank you for your response!</h3>
                    <a href="/" className="block mt-4 text-indigo-500 hover:underline">Create your own invitation!</a>
                </div>
            </div>
        `;

        return (
            <div className="flex flex-col items-center p-6 min-h-screen">
                <div className="w-full max-w-lg bg-white rounded-xl shadow-lg p-6 my-auto text-center">
                    <h1 className="text-4xl font-extrabold text-indigo-600 mb-2">You're Invited!</h1>
                    <p className="text-lg text-gray-700 mb-6">Join us as we celebrate our love.</p>
                    <div className="space-y-4">
                        <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-xl font-semibold text-gray-800">{invitationData.invitorName} & {invitationData.partnerName}</p>
                            <p className="text-gray-500 text-sm">{invitationData.date} at {invitationData.time}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-lg font-semibold text-gray-800">{invitationData.location}</p>
                        </div>
                    </div>
                    
                    <form onSubmit={handleRsvp} className="mt-8 space-y-4">
                        <input type="text" name="inviteeName" required placeholder="Your Full Name" className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                        <div className="flex flex-col space-y-2 text-left">
                            <div className="flex items-center space-x-2">
                                <input type="radio" id="coming" name="rsvpStatus" value="Coming" required className="form-radio text-indigo-600 focus:ring-indigo-500"/>
                                <label htmlFor="coming" className="text-gray-700">Coming</label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <input type="radio" id="not-coming" name="rsvpStatus" value="Can't Make It" required className="form-radio text-indigo-600 focus:ring-indigo-500"/>
                                <label htmlFor="not-coming" className="text-gray-700">Sorry, can't make it</label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <input type="radio" id="try" name="rsvpStatus" value="Will Try" required className="form-radio text-indigo-600 focus:ring-indigo-500"/>
                                <label htmlFor="try" className="text-gray-700">I will try</label>
                            </div>
                        </div>
                        <button type="submit" className="w-full bg-indigo-500 text-white font-bold py-3 px-8 rounded-full hover:bg-indigo-600 transition duration-300 transform hover:scale-105">Submit RSVP</button>
                    </form>
                    
                    <a href="/" className="block mt-6 text-indigo-500 hover:underline">Create your own invitation!</a>
                </div>
                
                <div id="rsvp-success-modal" className="modal hidden">
                    <div className="modal-content">
                        <h3 className="text-xl font-bold mb-4 text-green-600">Thank you for your response!</h3>
                        <button onClick={() => document.getElementById('rsvp-success-modal').classList.add('hidden')} className="mt-6 bg-indigo-500 text-white font-bold py-3 px-8 rounded-full hover:bg-indigo-600 transition duration-300">Close</button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="App">
            {page === 'invitor' ? (
                <InvitorPage />
            ) : (
                <InvitationPage />
            )}
        </div>
    );
};

export default App;
