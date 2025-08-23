
# Network Debugging System

A comprehensive network connection debugging system for the NY FASHION retail management application. This system provides real-time monitoring, error diagnostics, and recovery tools for network-related issues.

## Features

### 1. Network Status Monitor (`NetworkStatusMonitor.tsx`)
- Real-time connectivity status tracking
- Latency measurements and connection quality indicators
- Network type detection (when available)
- Built-in benchmark testing tools

### 2. API Debug Dashboard (`ApiDebugDashboard.tsx`)
- Live monitoring of all API calls
- Detailed request/response inspection
- Retry attempt visualization
- Error classification and filtering
- Failed request replay functionality

### 3. Connection Recovery Tools (`ConnectionRecovery.tsx`)
- Manual retry buttons for failed requests
- Cache clearing utilities
- Full connection state reset
- Quick recovery actions for common issues

### 4. Debug Settings Panel (`DebugSettingsPanel.tsx`)
- Toggle debug mode on/off
- Configurable logging levels
- Network simulation controls (slow, offline, intermittent)
- Retry parameter overrides

### 5. Debug Floating Button (`DebugFloatingButton.tsx`)
- Always-accessible debug tools in development
- Visual status indicators
- Keyboard shortcut support (`Ctrl+Shift+D`)
- Quick access to monitoring tools

## Integration

The debug system is fully integrated with the existing application:

### Context Integration
- `DebugContext` provides centralized state management
- Automatic network monitoring when debug mode is enabled
- API call tracking integrated with existing retry hooks

### Error Handling Enhancement
- Enhanced error reporting with network diagnostics
- DNS resolution testing
- Browser compatibility checks
- Detailed error context collection

### UI Integration
- Debug route at `/debug/network` (development only)
- Floating debug button in main layout
- Enhanced toast notifications with retry options
- Keyboard shortcuts for accessibility

## Usage

### Development Mode
1. Debug tools are automatically enabled in development
2. Access via the floating debug button (bottom-right corner)
3. Use `Ctrl+Shift+D` to toggle the debug panel
4. Visit `/debug/network` for full debugging interface

### Keyboard Shortcuts
- `Ctrl+Shift+D` - Toggle debug panel
- `Ctrl+Shift+R` - Hard refresh
- `Escape` - Close expanded debug panel
- `F12` - Developer tools

### Network Simulation
Test error handling with simulated network conditions:
- **Slow**: Adds 2-second delays to all requests
- **Offline**: Blocks all network requests
- **Intermittent**: 30% failure rate with 500ms delays

### Testing Utilities
The system includes comprehensive testing utilities:
- Network benchmark testing
- DNS resolution testing
- Endpoint health checks
- Error scenario simulation

## API

### Debug Context
```tsx
const { 
  networkStatus,
  apiCalls,
  debugSettings,
  checkNetworkStatus,
  retryFailedCall,
  clearCache
} = useDebug();
```

### Testing Utilities
```typescript
import { 
  networkSimulator,
  testEndpoint,
  runNetworkBenchmark 
} from '@/utils/debugTestUtils';

// Simulate network failure
networkSimulator.start({ condition: 'offline' });

// Test specific endpoint
const result = await testEndpoint('/api/health');

// Run comprehensive benchmark
const benchmark = await runNetworkBenchmark();
```

## Production Behavior

- All debug components are automatically disabled in production
- Debug routes return "not available" message in production
- No performance impact on production builds
- Debug context still provides basic functionality for error reporting

## Configuration

Debug settings can be configured through the Debug Settings Panel:
- **Log Level**: Control console logging verbosity
- **Max API Calls**: History limit for API call tracking
- **Network Simulation**: Test different connection scenarios
- **Retry Overrides**: Custom retry parameters for testing

## Error Classification

The system classifies errors into categories:
- **Network**: Connection issues, DNS failures
- **HTTP**: Status code errors (4xx, 5xx)
- **Timeout**: Request timeouts
- **Abort**: Cancelled requests
- **Business**: Application-specific errors

## Monitoring Capabilities

### Real-time Metrics
- Network connectivity status
- Request latency measurements
- API call success/failure rates
- Retry attempt tracking

### Visual Indicators
- Connection quality badges
- Status icons for different error types
- Progress indicators for pending operations
- Color-coded severity levels

## Troubleshooting

### Common Issues
1. **Debug tools not showing**: Ensure you're in development mode
2. **Network tests failing**: Check CORS settings and firewall
3. **Keyboard shortcuts not working**: Ensure focus is on the page
4. **Performance issues**: Reduce max API calls limit in settings

### Debugging Tips
1. Use the network benchmark to establish baseline performance
2. Check DNS resolution if seeing intermittent failures
3. Monitor the API dashboard during normal operations
4. Use network simulation to test error handling

## Security Considerations

- Debug tools are development-only and don't expose sensitive data
- Network diagnostics use safe, read-only operations
- All debug data is client-side only (no server storage)
- Proper cleanup of debug resources when components unmount
