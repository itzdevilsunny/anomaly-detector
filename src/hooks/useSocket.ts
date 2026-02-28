import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useVisionStore } from '../store/useVisionStore';
import { useAlertStore } from '../store/useAlertStore';
import { useEdgeStore } from '../store/useEdgeStore';
import { useNotificationStore } from '../store/useNotificationStore';

const SOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:4000';

export const useSocket = () => {
    const { addAlert, setCameras, updateCameraStatus } = useVisionStore();
    const addLiveAlert = useAlertStore((s) => s.addLiveAlert);
    const updateNodeTelemetry = useEdgeStore((s) => s.updateNodeTelemetry);
    const addLiveNotification = useNotificationStore((s) => s.addLiveNotification);

    useEffect(() => {
        // Prevent localhost connection errors on Vercel demo
        if (window.location.hostname.includes('vercel.app')) return;

        // Connect to the Node.js API Gateway
        const socket = io(SOCKET_URL, {
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socket.on('connect', () => {
            console.log('Connected to VisionAIoT Edge Node Gateway', socket.id);
        });

        // Listen for new anomalies published by the Python AI Service -> Redis -> Node -> Socket.io
        socket.on('new_anomaly', (alertData) => {
            console.log('New Anomaly Detected:', alertData);
            addAlert(alertData);

            // Feed the dedicated alert store (ensure status field exists)
            addLiveAlert({
                ...alertData,
                status: alertData.status || 'Pending',
            });
        });

        // Listen for Edge Node Camera status updates
        socket.on('camera_status', (data) => {
            updateCameraStatus(data.cameraId, data.status);
        });

        // Initialization payload
        socket.on('init_cameras', (cameraList) => {
            setCameras(cameraList);
        });

        // Edge node hardware heartbeats (CPU, RAM, Temperature, Uptime)
        socket.on('edge_heartbeat', (data) => {
            updateNodeTelemetry(data.id, data);
        });

        // System-wide notifications (parking capacity, edge health, security events)
        socket.on('system_alert', (data) => {
            console.log('System Alert:', data.title);
            addLiveNotification(data);
        });

        socket.on('disconnect', () => {
            console.warn('Disconnected from AIoT Gateway');
        });

        return () => {
            socket.disconnect();
        };
    }, [addAlert, addLiveAlert, setCameras, updateCameraStatus, updateNodeTelemetry, addLiveNotification]);

    return null;
};

