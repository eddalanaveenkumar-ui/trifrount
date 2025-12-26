// Capacitor Bridge Helper
// This file helps initialize Capacitor plugins when running in a native app

(function() {
    'use strict';

    // Wait for Capacitor to be available (injected by native bridge)
    function waitForCapacitor(callback, maxAttempts = 50) {
        let attempts = 0;

        const checkCapacitor = () => {
            attempts++;

            if (window.Capacitor) {
                console.log('Capacitor is available!');
                callback();
            } else if (attempts < maxAttempts) {
                setTimeout(checkCapacitor, 100);
            } else {
                console.warn('Capacitor not available after waiting. Running in web mode.');
                callback();
            }
        };

        checkCapacitor();
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            waitForCapacitor(() => {
                console.log('Capacitor bridge ready');
                window.dispatchEvent(new Event('capacitorReady'));
            });
        });
    } else {
        waitForCapacitor(() => {
            console.log('Capacitor bridge ready');
            window.dispatchEvent(new Event('capacitorReady'));
        });
    }
})();
