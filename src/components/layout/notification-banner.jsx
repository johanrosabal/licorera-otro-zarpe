'use client';

import { useState, useEffect } from 'react';
import { onSnapshot, query, collection, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Megaphone, X } from 'lucide-react';

export function NotificationBanner() {
    const [notification, setNotification] = useState(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('active', '==', true),
            where('type', '==', 'Public'),
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
    }, []);

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
        <div className="relative bg-primary text-primary-foreground">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-center gap-x-6 py-2">
                    <Megaphone className="h-5 w-5 flex-none" />
                    <div className="flex-1 text-sm leading-6 text-center">
                        <strong className="font-semibold">{notification.title}</strong>
                        <svg viewBox="0 0 2 2" className="mx-2 inline h-0.5 w-0.5 fill-current" aria-hidden="true"><circle cx={1} cy={1} r={1} /></svg>
                        {notification.message}
                    </div>
                     <button type="button" className="-m-1.5 flex-none p-1.5" onClick={handleDismiss}>
                        <span className="sr-only">Dismiss</span>
                        <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                </div>
            </div>
        </div>
    );
}
