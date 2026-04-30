'use client';

import { useState, useEffect } from 'react';
import { onSnapshot, query, collection, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export function InternalNotificationBanner() {
    const [notification, setNotification] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const { user } = useAuth();

    useEffect(() => {
        if (!user || user.role === 'CLIENT') return;

        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('active', '==', true),
            where('type', '==', 'Internal'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
            if (!snapshot.empty) {
                const now = new Date();
                let validNotification = null;

                for (const doc of snapshot.docs) {
                    const notif = { id: doc.id, ...doc.data() };
                    const startDate = notif.startDate ? notif.startDate.toDate() : null;
                    const endDate = notif.endDate ? notif.endDate.toDate() : null;
                    
                    if ((!startDate || now >= startDate) && (!endDate || now <= endDate)) {
                        validNotification = notif;
                        break;
                    }
                }

                if (validNotification) {
                    const dismissed = sessionStorage.getItem(`dismissed_notification_${validNotification.id}`);
                    if (!dismissed) {
                        setNotification(validNotification);
                        setIsVisible(true);
                    }
                } else {
                    setNotification(null);
                    setIsVisible(false);
                }
            } else {
                setNotification(null);
                setIsVisible(false);
            }
        });

        return () => unsubscribe();
    }, [user]);

    const handleDismiss = () => {
        if (notification) {
            sessionStorage.setItem(`dismissed_notification_${notification.id}`, 'true');
            setIsVisible(false);
        }
    };

    if (!isVisible || !notification) {
        return null;
    }

    return (
        <Alert className="mb-6 border-blue-500/50 text-blue-700 dark:text-blue-300 [&>svg]:text-blue-500">
            <Info className="h-4 w-4" />
            <div className="flex justify-between items-start">
                <div>
                    <AlertTitle className="font-bold">{notification.title}</AlertTitle>
                    <AlertDescription>
                        {notification.message}
                    </AlertDescription>
                </div>
                 <button type="button" className="-m-1.5 p-1.5 text-current" onClick={handleDismiss}>
                    <span className="sr-only">Dismiss</span>
                    <X className="h-5 w-5" aria-hidden="true" />
                </button>
            </div>
        </Alert>
    );
}
