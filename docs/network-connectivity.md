# Network Connectivity Documentation

## How Connectivity Detection Works

The system uses two mechanisms to detect connectivity:
1. **Browser Detection**: `navigator.onLine` provides immediate online/offline status
2. **API Heartbeat**: Periodic API requests verify actual server connectivity

## Retry Mechanism

Automatic pause/resume of network requests:
- Requests pause when offline
- Automatically resume when connectivity is restored
- Configurable retry intervals via environment variables

## Offline Queue System

- Failed requests are queued with unique idempotency keys
- Prevents duplicate processing when requests are retried
- Queued requests process in order when connectivity resumes

## Configuration

Environment variables:
- `RETRY_INTERVAL`: Milliseconds between retry attempts (default: 5000)
- `MAX_RETRY_ATTEMPTS`: Maximum retry attempts (default: 3)
- `HEARTBEAT_INTERVAL`: API heartbeat frequency (default: 30000)

## Troubleshooting

1. Check browser console for connectivity logs
2. Verify environment variables are set correctly
3. Confirm API endpoint accessibility
4. Review offline queue status in debug tools