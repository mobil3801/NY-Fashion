
async function generatePayrollReport(reportType, startDate, endDate) {
    try {
        // Get all payslips in the date range
        const payslips = await ezsite.db.getRows('payslips', {
            filters: [
                { field: 'pay_period_start', op: 'gte', value: startDate },
                { field: 'pay_period_end', op: 'lte', value: endDate }
            ]
        });

        if (payslips.length === 0) {
            return {
                message: 'No payroll data found for the specified date range',
                totalGross: 0,
                totalDeductions: 0,
                totalNet: 0,
                employeeCount: 0,
                payslips: []
            };
        }

        // Calculate totals
        const totals = payslips.reduce((acc, payslip) => {
            acc.totalGross += parseFloat(payslip.gross_total || '0');
            acc.totalDeductions += parseFloat(payslip.total_deductions || '0');
            acc.totalNet += parseFloat(payslip.net_pay || '0');
            acc.federalTax += parseFloat(payslip.federal_tax || '0');
            acc.stateTax += parseFloat(payslip.state_tax || '0');
            acc.socialSecurity += parseFloat(payslip.social_security || '0');
            acc.medicare += parseFloat(payslip.medicare || '0');
            acc.healthInsurance += parseFloat(payslip.health_insurance || '0');
            acc.retirement += parseFloat(payslip.retirement_contribution || '0');
            acc.regularHours += parseFloat(payslip.regular_hours || '0');
            acc.overtimeHours += parseFloat(payslip.overtime_hours || '0');
            acc.commission += parseFloat(payslip.commission || '0');
            return acc;
        }, {
            totalGross: 0,
            totalDeductions: 0,
            totalNet: 0,
            federalTax: 0,
            stateTax: 0,
            socialSecurity: 0,
            medicare: 0,
            healthInsurance: 0,
            retirement: 0,
            regularHours: 0,
            overtimeHours: 0,
            commission: 0
        });

        // Get unique employees
        const uniqueEmployees = [...new Set(payslips.map(p => p.employee_id))];
        
        let reportData = {
            ...totals,
            employeeCount: uniqueEmployees.length,
            payslipCount: payslips.length,
            averageGrossPay: totals.totalGross / payslips.length,
            averageNetPay: totals.totalNet / payslips.length,
            averageHours: (totals.regularHours + totals.overtimeHours) / payslips.length
        };

        // Generate specific report data based on type
        switch (reportType) {
            case 'summary':
                // Summary data already calculated above
                break;

            case 'detailed':
                reportData.payslips = payslips.map(payslip => ({
                    employee_name: payslip.employee_name,
                    pay_period: `${payslip.pay_period_start} to ${payslip.pay_period_end}`,
                    regular_hours: payslip.regular_hours,
                    overtime_hours: payslip.overtime_hours,
                    gross_pay: payslip.gross_total,
                    total_deductions: payslip.total_deductions,
                    net_pay: payslip.net_pay,
                    status: payslip.status
                }));
                break;

            case 'tax':
                reportData.taxBreakdown = {
                    federalTax: totals.federalTax,
                    stateTax: totals.stateTax,
                    socialSecurity: totals.socialSecurity,
                    medicare: totals.medicare,
                    totalTaxes: totals.federalTax + totals.stateTax + totals.socialSecurity + totals.medicare,
                    otherDeductions: totals.healthInsurance + totals.retirement,
                    taxRate: ((totals.federalTax + totals.stateTax + totals.socialSecurity + totals.medicare) / totals.totalGross * 100).toFixed(2)
                };
                break;

            case 'department':
                // Get employees with department info
                const employees = await ezsite.db.getRows('employees');
                const employeeMap = employees.reduce((map, emp) => {
                    map[emp.id] = emp;
                    return map;
                }, {});

                // Group payslips by department
                const departmentData = {};
                payslips.forEach(payslip => {
                    const employee = employeeMap[payslip.employee_id];
                    const department = employee?.department || 'Unknown';
                    
                    if (!departmentData[department]) {
                        departmentData[department] = {
                            department,
                            employeeCount: new Set(),
                            totalGross: 0,
                            totalNet: 0,
                            totalHours: 0,
                            payslipCount: 0
                        };
                    }
                    
                    departmentData[department].employeeCount.add(payslip.employee_id);
                    departmentData[department].totalGross += parseFloat(payslip.gross_total || '0');
                    departmentData[department].totalNet += parseFloat(payslip.net_pay || '0');
                    departmentData[department].totalHours += parseFloat(payslip.regular_hours || '0') + parseFloat(payslip.overtime_hours || '0');
                    departmentData[department].payslipCount += 1;
                });

                // Convert to array and calculate averages
                reportData.departments = Object.values(departmentData).map(dept => ({
                    department: dept.department,
                    employeeCount: dept.employeeCount.size,
                    totalGross: dept.totalGross,
                    totalNet: dept.totalNet,
                    averageGross: dept.totalGross / dept.payslipCount,
                    averageNet: dept.totalNet / dept.payslipCount,
                    averageHours: dept.totalHours / dept.payslipCount,
                    payslipCount: dept.payslipCount
                }));
                break;
        }

        return reportData;

    } catch (error) {
        console.error('Error generating payroll report:', error);
        throw error;
    }
}
