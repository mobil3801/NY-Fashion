
import React, { useEffect, useState } from 'react';
import { Clock, Play, Square, Coffee, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useEmployee } from '@/contexts/EmployeeContext';
import { useAuth } from '@/contexts/AuthContext';

const QuickTimeTracker: React.FC = () => {
  const { user } = useAuth();
  const { currentStatus, clockInOut, loadTimeTracking, loading } = useEmployee();
  const [location, setLocation] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Load current user's time tracking status
  useEffect(() => {
    if (user?.employeeId) {
      loadTimeTracking(user.employeeId);
    }
  }, [user?.employeeId]);

  const handleQuickClockIn = async () => {
    if (!user?.employeeId) return;
    
    try {
      await clockInOut(user.employeeId, 'clock_in', location);
      setLocation('');
    } catch (error) {
      console.error('Clock in failed:', error);
    }
  };

  const handleQuickClockOut = async () => {
    if (!user?.employeeId) return;
    
    try {
      await clockInOut(user.employeeId, 'clock_out');
    } catch (error) {
      console.error('Clock out failed:', error);
    }
  };

  const getCurrentShiftDuration = () => {
    if (!currentStatus || !currentStatus.clock_in_time) return '00:00:00';
    
    const clockIn = new Date(currentStatus.clock_in_time);
    const diff = currentTime.getTime() - clockIn.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = () => {
    if (!currentStatus) {
      return <Badge variant="secondary">Clocked Out</Badge>;
    }
    
    switch (currentStatus.status) {
      case 'clocked_in':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Clocked In</Badge>;
      case 'on_break':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">On Break</Badge>;
      default:
        return <Badge variant="secondary">Clocked Out</Badge>;
    }
  };

  // Don't show if user doesn't have employee access
  if (!user?.employeeId) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Quick Time Tracker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          {getStatusBadge()}
          {currentStatus && currentStatus.status !== 'clocked_out' && (
            <div className="text-xl font-mono font-bold">
              {getCurrentShiftDuration()}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {!currentStatus || currentStatus.status === 'clocked_out' ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button className="flex-1">
                  <Play className="h-4 w-4 mr-2" />
                  Clock In
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Clock In</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Location (Optional)</label>
                    <div className="flex items-center gap-2 mt-1">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <Input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g., Main Office, Store #1"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button 
                      onClick={handleQuickClockIn}
                      disabled={loading}
                    >
                      {loading ? 'Clocking In...' : 'Clock In'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <>
              {currentStatus.status === 'clocked_in' && (
                <>
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => clockInOut(user.employeeId!, 'break_start')}
                    disabled={loading}
                  >
                    <Coffee className="h-4 w-4 mr-2" />
                    Break
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={handleQuickClockOut}
                    disabled={loading}
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Clock Out
                  </Button>
                </>
              )}
              
              {currentStatus.status === 'on_break' && (
                <Button 
                  className="flex-1"
                  onClick={() => clockInOut(user.employeeId!, 'break_end')}
                  disabled={loading}
                >
                  <Play className="h-4 w-4 mr-2" />
                  End Break
                </Button>
              )}
            </>
          )}
        </div>

        {currentStatus && currentStatus.clock_in_time && (
          <div className="text-xs text-gray-500 text-center">
            Clocked in at {new Date(currentStatus.clock_in_time).toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QuickTimeTracker;
