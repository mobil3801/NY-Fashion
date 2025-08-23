
import React, { useState, useEffect } from 'react';
import { Clock, Play, Pause, Square, Coffee, MapPin, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEmployee } from '@/contexts/EmployeeContext';
import { Employee } from '@/types/employee';

interface TimeTrackingProps {
  employee: Employee;
}

const TimeTracking: React.FC<TimeTrackingProps> = ({ employee }) => {
  const {
    currentStatus,
    timeEntries,
    loading,
    clockInOut,
    loadTimeTracking
  } = useEmployee();

  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Load time tracking data on mount
  useEffect(() => {
    if (employee.id) {
      loadTimeTracking(employee.id);
    }
  }, [employee.id]);

  const handleClockAction = async (action: 'clock_in' | 'clock_out' | 'break_start' | 'break_end') => {
    try {
      await clockInOut(employee.id!, action, location, notes);
      setLocation('');
      setNotes('');
    } catch (error) {
      console.error('Clock action failed:', error);
    }
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

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getCurrentShiftDuration = () => {
    if (!currentStatus || !currentStatus.clock_in_time) return '00:00:00';

    const clockIn = new Date(currentStatus.clock_in_time);
    const diff = currentTime.getTime() - clockIn.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff % (1000 * 60 * 60) / (1000 * 60));
    const seconds = Math.floor(diff % (1000 * 60) / 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Current Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              {getStatusBadge()}
              {currentStatus && currentStatus.status !== 'clocked_out' &&
              <div className="text-sm text-gray-600">
                  Since: {formatTime(currentStatus.clock_in_time)}
                </div>
              }
            </div>
            {currentStatus && currentStatus.status !== 'clocked_out' &&
            <div className="text-2xl font-mono font-bold">
                {getCurrentShiftDuration()}
              </div>
            }
          </div>

          <div className="flex gap-2">
            {!currentStatus || currentStatus.status === 'clocked_out' ?
            <Dialog>
                <DialogTrigger asChild>
                  <Button>
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
                      <Label htmlFor="location">Location (Optional)</Label>
                      <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g., Main Office, Store #1" />

                    </div>
                    <div>
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any notes for this shift..."
                      rows={3} />

                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                      onClick={() => handleClockAction('clock_in')}
                      disabled={loading}>

                        {loading ? 'Clocking In...' : 'Clock In'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog> :

            <>
                {currentStatus.status === 'clocked_in' &&
              <>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <Coffee className="h-4 w-4 mr-2" />
                          Start Break
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Start Break</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="break-notes">Break Notes (Optional)</Label>
                            <Textarea
                          id="break-notes"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Lunch break, coffee break, etc."
                          rows={2} />

                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                          onClick={() => handleClockAction('break_start')}
                          disabled={loading}>

                              {loading ? 'Starting Break...' : 'Start Break'}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button>
                          <Square className="h-4 w-4 mr-2" />
                          Clock Out
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Clock Out</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="clock-out-notes">End of Shift Notes (Optional)</Label>
                            <Textarea
                          id="clock-out-notes"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Summary of work completed, issues, etc."
                          rows={3} />

                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                          onClick={() => handleClockAction('clock_out')}
                          disabled={loading}>

                              {loading ? 'Clocking Out...' : 'Clock Out'}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </>
              }

                {currentStatus.status === 'on_break' &&
              <Button onClick={() => handleClockAction('break_end')} disabled={loading}>
                    <Play className="h-4 w-4 mr-2" />
                    {loading ? 'Ending Break...' : 'End Break'}
                  </Button>
              }
              </>
            }
          </div>
        </CardContent>
      </Card>

      {/* Recent Time Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {timeEntries.length === 0 ?
          <div className="text-center py-8 text-gray-500">
              No time entries found
            </div> :

          <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Total Hours</TableHead>
                    <TableHead>Break Hours</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeEntries.map((entry) =>
                <TableRow key={entry.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          {formatDate(entry.clock_in_time)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-green-600" />
                          {formatTime(entry.clock_in_time)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {entry.clock_out_time ?
                    <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-red-600" />
                            {formatTime(entry.clock_out_time)}
                          </div> :

                    <Badge className="bg-green-100 text-green-800 border-green-300">
                            In Progress
                          </Badge>
                    }
                      </TableCell>
                      <TableCell>
                        {entry.total_hours ? `${entry.total_hours}h` : '-'}
                      </TableCell>
                      <TableCell>
                        {entry.break_hours ? `${entry.break_hours}h` : '-'}
                      </TableCell>
                      <TableCell>
                        {entry.location &&
                    <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            {entry.location}
                          </div>
                    }
                      </TableCell>
                      <TableCell>
                        {entry.notes &&
                    <div className="max-w-xs truncate" title={entry.notes}>
                            {entry.notes}
                          </div>
                    }
                      </TableCell>
                    </TableRow>
                )}
                </TableBody>
              </Table>
            </div>
          }
        </CardContent>
      </Card>
    </div>);

};

export default TimeTracking;