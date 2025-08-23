
async function processPayrollRun(runId) {
    try {
        // Get payroll run details
        const payrollRun = await ezsite.db.getById('payroll_runs', runId);
        if (!payrollRun) {
            throw new Error('Payroll run not found');
        }

        if (payrollRun.status !== 'draft') {
            throw new Error('Only draft payroll runs can be processed');
        }

        // Update status to processing
        await ezsite.db.update('payroll_runs', runId, {
            status: 'processing'
        });

        // Get all active employees
        const employees = await ezsite.db.getRows('employees', {
            filters: [{ field: 'status', op: 'eq', value: 'active' }]
        });

        let totalGross = 0;
        let totalDeductions = 0;
        let totalNet = 0;
        let processedCount = 0;

        for (const employee of employees) {
            try {
                // Calculate hours worked during pay period
                const timeEntries = await ezsite.db.getRows('time_entries', {
                    filters: [
                        { field: 'employee_id', op: 'eq', value: employee.id },
                        { field: 'clock_in', op: 'gte', value: payrollRun.start_date },
                        { field: 'clock_in', op: 'lte', value: payrollRun.end_date }
                    ]
                });

                let totalHours = 0;
                let overtimeHours = 0;

                // Calculate total hours from time entries
                for (const entry of timeEntries) {
                    if (entry.clock_out) {
                        const clockIn = new Date(entry.clock_in);
                        const clockOut = new Date(entry.clock_out);
                        const hours = (clockOut - clockIn) / (1000 * 60 * 60); // Convert to hours
                        totalHours += hours;
                    }
                }

                // Calculate overtime (over 40 hours per week)
                if (totalHours > 40) {
                    overtimeHours = totalHours - 40;
                    totalHours = 40;
                }

                // Get employee pay structure
                const baseRate = parseFloat(employee.hourly_rate || '0');
                const overtimeRate = baseRate * 1.5;

                // Calculate gross pay
                let grossPay = 0;
                if (employee.pay_type === 'hourly') {
                    grossPay = (totalHours * baseRate) + (overtimeHours * overtimeRate);
                } else if (employee.pay_type === 'salary') {
                    // For salary, calculate based on pay period
                    const annualSalary = parseFloat(employee.annual_salary || '0');
                    if (payrollRun.pay_period_type === 'biweekly') {
                        grossPay = annualSalary / 26; // 26 pay periods per year
                    } else if (payrollRun.pay_period_type === 'monthly') {
                        grossPay = annualSalary / 12; // 12 pay periods per year
                    } else if (payrollRun.pay_period_type === 'weekly') {
                        grossPay = annualSalary / 52; // 52 pay periods per year
                    }
                }

                // Calculate commission if applicable
                let commission = 0;
                if (employee.commission_rate && parseFloat(employee.commission_rate) > 0) {
                    const sales = await ezsite.db.getRows('sales', {
                        filters: [
                            { field: 'employee_id', op: 'eq', value: employee.id },
                            { field: 'sale_date', op: 'gte', value: payrollRun.start_date },
                            { field: 'sale_date', op: 'lte', value: payrollRun.end_date }
                        ]
                    });

                    const totalSales = sales.reduce((sum, sale) => sum + parseFloat(sale.total_amount || '0'), 0);
                    commission = totalSales * (parseFloat(employee.commission_rate) / 100);
                }

                const grossTotal = grossPay + commission;

                // Calculate deductions (basic tax calculation - in real scenario, this would be more complex)
                const federalTax = grossTotal * 0.12; // Simplified federal tax
                const stateTax = grossTotal * 0.05; // Simplified state tax
                const socialSecurity = grossTotal * 0.062;
                const medicare = grossTotal * 0.0145;
                const healthInsurance = parseFloat(employee.health_insurance_deduction || '0');
                const retirement = parseFloat(employee.retirement_contribution || '0');

                const totalDeductionsAmount = federalTax + stateTax + socialSecurity + medicare + healthInsurance + retirement;
                const netPay = grossTotal - totalDeductionsAmount;

                // Create payslip
                await ezsite.db.insert('payslips', {
                    payroll_run_id: runId,
                    employee_id: employee.id,
                    employee_name: employee.first_name + ' ' + employee.last_name,
                    pay_period_start: payrollRun.start_date,
                    pay_period_end: payrollRun.end_date,
                    regular_hours: totalHours,
                    overtime_hours: overtimeHours,
                    regular_rate: baseRate,
                    overtime_rate: overtimeRate,
                    gross_pay: grossPay,
                    commission: commission,
                    gross_total: grossTotal,
                    federal_tax: federalTax,
                    state_tax: stateTax,
                    social_security: socialSecurity,
                    medicare: medicare,
                    health_insurance: healthInsurance,
                    retirement_contribution: retirement,
                    total_deductions: totalDeductionsAmount,
                    net_pay: netPay,
                    status: 'generated',
                    generated_at: new Date().toISOString()
                });

                totalGross += grossTotal;
                totalDeductions += totalDeductionsAmount;
                totalNet += netPay;
                processedCount++;

            } catch (error) {
                console.error(`Error processing payroll for employee ${employee.id}:`, error);
                // Continue processing other employees
            }
        }

        // Update payroll run with totals
        await ezsite.db.update('payroll_runs', runId, {
            status: 'completed',
            total_gross: totalGross,
            total_deductions: totalDeductions,
            total_net: totalNet,
            employee_count: processedCount,
            completed_at: new Date().toISOString()
        });

        return {
            message: `Payroll processed successfully for ${processedCount} employees`,
            total_gross: totalGross,
            total_deductions: totalDeductions,
            total_net: totalNet,
            employee_count: processedCount
        };

    } catch (error) {
        // Update payroll run status to error if something went wrong
        if (runId) {
            await ezsite.db.update('payroll_runs', runId, {
                status: 'draft',
                error_message: error.message
            });
        }
        throw error;
    }
}
