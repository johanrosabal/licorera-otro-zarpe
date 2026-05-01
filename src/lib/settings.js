
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { logError } from './errors';

const settingsCollectionRef = 'settings';
const homepageDocRef = doc(db, settingsCollectionRef, 'homepage');

// Function to upload an image to Firebase Storage
async function uploadImage(imageFile, path) {
    const storageRef = ref(storage, `${path}/${Date.now()}-${imageFile.name}`);
    await uploadBytes(storageRef, imageFile);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
}

// Get homepage settings
export const getHomepageSettings = async () => {
    try {
        const docSnap = await getDoc(homepageDocRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
        return { deliveriesEnabled: true, siteName: 'OTRO ZARPE' }; // Default values
    } catch (error) {
        logError(error, 'getHomepageSettings');
        throw error;
    }
};

// Update homepage settings
export const updateHomepageSettings = async (data) => {
    try {
        const settingsToUpdate = {
            updatedAt: serverTimestamp(),
        };
        
        if (data.facebookUrl !== undefined) settingsToUpdate.facebookUrl = data.facebookUrl;
        if (data.instagramUrl !== undefined) settingsToUpdate.instagramUrl = data.instagramUrl;
        if (data.twitterUrl !== undefined) settingsToUpdate.twitterUrl = data.twitterUrl;
        if (data.whatsappUrl !== undefined) settingsToUpdate.whatsappUrl = data.whatsappUrl;
        if (data.deliveryOriginLat !== undefined) settingsToUpdate.deliveryOriginLat = data.deliveryOriginLat;
        if (data.deliveryOriginLng !== undefined) settingsToUpdate.deliveryOriginLng = data.deliveryOriginLng;
        if (data.deliveriesEnabled !== undefined) settingsToUpdate.deliveriesEnabled = data.deliveriesEnabled;
        if (data.storeLocationUrl !== undefined) settingsToUpdate.storeLocationUrl = data.storeLocationUrl;
        if (data.siteName !== undefined) settingsToUpdate.siteName = data.siteName;
        if (data.siteSlogan !== undefined) settingsToUpdate.siteSlogan = data.siteSlogan;

        await setDoc(homepageDocRef, settingsToUpdate, { merge: true });
    } catch (error) {
        logError(error, 'updateHomepageSettings');
        throw error;
    }
};
