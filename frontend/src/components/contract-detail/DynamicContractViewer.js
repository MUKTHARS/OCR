    import React, { useState } from 'react';
    import {
    Box,
    Typography,
    Card,
    CardContent,
    Chip,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Grid,
    List,ListItem,ListItemText, ListItemIcon
    } from '@mui/material';
    import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
    import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SpeedIcon from '@mui/icons-material/Speed';
import WarningIcon from '@mui/icons-material/Warning';
import SecurityIcon from '@mui/icons-material/Security';
import DescriptionIcon from '@mui/icons-material/Description';
import TableChartIcon from '@mui/icons-material/TableChart';
    import {
    GavelOutlined,
    AttachMoneyOutlined,
    AssessmentOutlined,
    CheckCircleOutlined,
    SpeedOutlined,
    WarningAmberOutlined,
    SecurityOutlined,
    DescriptionOutlined,
    TableChartOutlined,
    } from '@mui/icons-material';
    import GavelIcon from '@mui/icons-material/Gavel';
    const DynamicContractViewer = ({ contract }) => {
    const [expandedSections, setExpandedSections] = useState({});
    
    const toggleSection = (sectionName) => {
        setExpandedSections(prev => ({
        ...prev,
        [sectionName]: !prev[sectionName]
        }));
    };
    
    const renderDynamicContent = () => {
        if (!contract) return null;
        
        const sections = [];
        
        // 1. Clauses (always present)
        if (contract.clauses && Object.keys(contract.clauses).length > 0) {
        sections.push({
            title: "Clauses & Provisions",
            content: renderClauses(contract.clauses),
            icon: <GavelIcon />,
            priority: "high"
        });
        }
        
        // 2. Payment Schedule (dynamic detection)
        if (contract.payment_schedule || contract.tables_and_schedules?.payment_schedule) {
        sections.push({
            title: "Payment Schedule",
            content: renderPaymentSchedule(contract),
            icon: <AttachMoneyIcon />,
            priority: "high"
        });
        }
        
        // 3. Reporting Requirements
        if (contract.compliance_requirements?.reporting_requirements || 
            hasReportingInClauses(contract.clauses)) {
        sections.push({
            title: "Reporting Requirements",
            content: renderReportingRequirements(contract),
            icon: <AssessmentIcon />,
            priority: "medium"
        });
        }
        
        // 4. Deliverables
        if (contract.deliverables && contract.deliverables.length > 0) {
        sections.push({
            title: "Deliverables",
            content: renderDeliverables(contract.deliverables),
            icon: <CheckCircleIcon />,
            priority: "high"
        });
        }
        
        // 5. Service Levels
        if (contract.service_levels && Object.keys(contract.service_levels).length > 0) {
        sections.push({
            title: "Service Level Agreements",
            content: renderServiceLevels(contract.service_levels),
            icon: <SpeedIcon />,
            priority: "medium"
        });
        }
        
        // 6. Risk Indicators
        if (contract.risk_indicators && Object.keys(contract.risk_indicators).length > 0) {
        sections.push({
            title: "Risk Indicators",
            content: renderRiskIndicators(contract.risk_indicators),
            icon: <WarningIcon />,
            priority: "high"
        });
        }
        
        // 7. Compliance Requirements
        if (contract.compliance_requirements && Object.keys(contract.compliance_requirements).length > 0) {
        sections.push({
            title: "Compliance Requirements",
            content: renderComplianceRequirements(contract.compliance_requirements),
            icon: <SecurityIcon />,
            priority: "medium"
        });
        }
        
        // 8. All extracted sections (dynamic)
        if (contract.extracted_sections && Object.keys(contract.extracted_sections).length > 0) {
        sections.push({
            title: "All Document Sections",
            content: renderAllSections(contract.extracted_sections),
            icon: <DescriptionIcon />,
            priority: "low"
        });
        }
        
        // 9. Tables and Schedules
        if (contract.tables_and_schedules && Object.keys(contract.tables_and_schedules).length > 0) {
        sections.push({
            title: "Tables & Schedules",
            content: renderTables(contract.tables_and_schedules),
            icon: <TableChartIcon />,
            priority: "medium"
        });
        }
        
        // 10. Key Fields
        if (contract.key_fields && Object.keys(contract.key_fields).length > 0) {
        sections.push({
            title: "Key Fields",
            content: renderKeyFields(contract.key_fields),
            // icon: <KeyIcon />,
            icon: <DescriptionIcon />,
            priority: "high"
        });
        }
        
        // Sort by priority
        const priorityOrder = { high: 1, medium: 2, low: 3 };
        sections.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        
        return sections;
    };
    
    const renderPaymentSchedule = (contract) => {
        const schedule = contract.payment_schedule || 
                        JSON.parse(contract.tables_and_schedules?.payment_schedule || '[]');
        
        if (!schedule || schedule.length === 0) return null;
        
        return (
        <TableContainer component={Paper}>
            <Table>
            <TableHead>
                <TableRow>
                <TableCell>Milestone / Description</TableCell>
                <TableCell align="right">Percentage</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell>Conditions</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {schedule.map((item, idx) => (
                <TableRow key={idx}>
                    <TableCell>{item.milestone || item.description}</TableCell>
                    <TableCell align="right">
                    {item.percentage ? `${item.percentage}%` : 'N/A'}
                    </TableCell>
                    <TableCell align="right">
                    {item.amount ? `${contract.currency || 'USD'} ${item.amount.toLocaleString()}` : 'N/A'}
                    </TableCell>
                    <TableCell>{item.due_date || 'Not specified'}</TableCell>
                    <TableCell>{item.conditions || 'None'}</TableCell>
                </TableRow>
                ))}
            </TableBody>
            </Table>
        </TableContainer>
        );
    };
    // Add these functions inside the DynamicContractViewer component:

    const renderKeyFields = (keyFields) => {
    if (!keyFields || Object.keys(keyFields).length === 0) return null;
    
    return (
        <Grid container spacing={2}>
        {Object.entries(keyFields).map(([fieldName, fieldData]) => (
            <Grid item xs={12} sm={6} md={4} key={fieldName}>
            <Card variant="outlined">
                <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                    {fieldName.replace(/_/g, ' ')}
                </Typography>
                <Typography variant="body1" gutterBottom>
                    {fieldData.value || 'Not found'}
                </Typography>
                {fieldData.confidence && (
                    <Chip
                    label={`${Math.round(fieldData.confidence * 100)}% confidence`}
                    size="small"
                    color={fieldData.confidence >= 0.9 ? 'success' : fieldData.confidence >= 0.7 ? 'warning' : 'error'}
                    />
                )}
                </CardContent>
            </Card>
            </Grid>
        ))}
        </Grid>
    );
    };

    const renderClauses = (clauses) => {
    if (!clauses || Object.keys(clauses).length === 0) return null;
    
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {Object.entries(clauses).map(([clauseName, clauseData]) => (
            <Accordion key={clauseName}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="subtitle1">
                    {clauseName.replace(/_/g, ' ').toUpperCase()}
                </Typography>
                {clauseData.confidence && (
                    <Chip
                    label={`${Math.round(clauseData.confidence * 100)}%`}
                    size="small"
                    color={clauseData.confidence >= 0.9 ? 'success' : clauseData.confidence >= 0.7 ? 'warning' : 'error'}
                    />
                )}
                </Box>
            </AccordionSummary>
            <AccordionDetails>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {clauseData.text || JSON.stringify(clauseData, null, 2)}
                </Typography>
            </AccordionDetails>
            </Accordion>
        ))}
        </Box>
    );
    };

    const renderDeliverables = (deliverables) => {
    if (!deliverables || deliverables.length === 0) return null;
    
    return (
        <TableContainer component={Paper}>
        <Table>
            <TableHead>
            <TableRow>
                <TableCell>Item</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell>Milestone</TableCell>
                <TableCell>Status</TableCell>
            </TableRow>
            </TableHead>
            <TableBody>
            {deliverables.map((item, idx) => (
                <TableRow key={idx}>
                <TableCell>{item.item || item.description}</TableCell>
                <TableCell>{item.due_date || 'Not specified'}</TableCell>
                <TableCell>{item.milestone || 'N/A'}</TableCell>
                <TableCell>{item.status || 'Pending'}</TableCell>
                </TableRow>
            ))}
            </TableBody>
        </Table>
        </TableContainer>
    );
    };

    const renderServiceLevels = (serviceLevels) => {
    if (!serviceLevels || Object.keys(serviceLevels).length === 0) return null;
    
    return (
        <Grid container spacing={2}>
        {Object.entries(serviceLevels).map(([kpi, details]) => (
            <Grid item xs={12} md={6} key={kpi}>
            <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>{kpi}</Typography>
                <Grid container spacing={1}>
                {details.target && (
                    <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Target</Typography>
                    <Typography variant="body2">{details.target}</Typography>
                    </Grid>
                )}
                {details.measurement_period && (
                    <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Period</Typography>
                    <Typography variant="body2">{details.measurement_period}</Typography>
                    </Grid>
                )}
                {details.remedies && (
                    <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Remedies</Typography>
                    <Typography variant="body2">{details.remedies}</Typography>
                    </Grid>
                )}
                </Grid>
            </Paper>
            </Grid>
        ))}
        </Grid>
    );
    };

    const renderRiskIndicators = (riskIndicators) => {
    if (!riskIndicators || Object.keys(riskIndicators).length === 0) return null;
    
    return (
        <Grid container spacing={2}>
        {Object.entries(riskIndicators).map(([indicator, value]) => (
            <Grid item xs={12} sm={6} md={4} key={indicator}>
            <Paper sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">
                {indicator.replace(/_/g, ' ')}
                </Typography>
                {typeof value === 'boolean' ? (
                <Chip
                    label={value ? 'Yes' : 'No'}
                    color={value ? 'error' : 'success'}
                    size="small"
                />
                ) : (
                <Typography variant="body1">{value}</Typography>
                )}
            </Paper>
            </Grid>
        ))}
        </Grid>
    );
    };

    const renderComplianceRequirements = (compliance) => {
    if (!compliance || Object.keys(compliance).length === 0) return null;
    
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {Object.entries(compliance).map(([requirement, value]) => (
            <Paper key={requirement} sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
                {requirement.replace(/_/g, ' ').toUpperCase()}
            </Typography>
            {Array.isArray(value) ? (
                <List dense>
                {value.map((item, idx) => (
                    <ListItem key={idx}>
                    <ListItemText primary={item} />
                    </ListItem>
                ))}
                </List>
            ) : (
                <Typography variant="body2">{value.toString()}</Typography>
            )}
            </Paper>
        ))}
        </Box>
    );
    };
    const renderReportingRequirements = (contract) => {
        const reporting = contract.compliance_requirements?.reporting_requirements || 
                        extractReportingFromClauses(contract.clauses);
        
        if (!reporting || reporting.length === 0) return null;
        
        return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {Array.isArray(reporting) ? (
            <List>
                {reporting.map((req, idx) => (
                <ListItem key={idx}>
                    <ListItemIcon>
                    <DescriptionIcon />
                    </ListItemIcon>
                    <ListItemText 
                    primary={typeof req === 'string' ? req : req.type}
                    secondary={typeof req === 'object' ? req.details : 'Reporting requirement'}
                    />
                </ListItem>
                ))}
            </List>
            ) : (
            <Typography variant="body1">{reporting}</Typography>
            )}
        </Box>
        );
    };
    
    const renderAllSections = (sections) => {
        return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {Object.entries(sections).map(([sectionName, sectionData]) => (
            <Accordion key={sectionName}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">
                    {sectionName.replace(/_/g, ' ').toUpperCase()}
                    {sectionData.category && (
                    <Chip 
                        label={sectionData.category} 
                        size="small" 
                        sx={{ ml: 2 }}
                    />
                    )}
                </Typography>
                </AccordionSummary>
                <AccordionDetails>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {sectionData.text}
                </Typography>
                {sectionData.page_number && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Source: Page {sectionData.page_number}
                    </Typography>
                )}
                </AccordionDetails>
            </Accordion>
            ))}
        </Box>
        );
    };
    
    const renderTables = (tables) => {
        return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {Object.entries(tables).map(([tableName, tableData]) => (
            <Card key={tableName} variant="outlined">
                <CardContent>
                <Typography variant="h6" gutterBottom>
                    {tableName.replace(/_/g, ' ').toUpperCase()}
                </Typography>
                {typeof tableData === 'string' ? (
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                    {tableData}
                    </Typography>
                ) : (
                    <pre style={{ 
                    whiteSpace: 'pre-wrap', 
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    backgroundColor: '#f5f5f5',
                    padding: '1rem',
                    borderRadius: '4px'
                    }}>
                    {JSON.stringify(tableData, null, 2)}
                    </pre>
                )}
                </CardContent>
            </Card>
            ))}
        </Box>
        );
    };
    
    // Helper functions
    const hasReportingInClauses = (clauses) => {
        if (!clauses) return false;
        return Object.keys(clauses).some(key => 
        key.toLowerCase().includes('report') || 
        (clauses[key]?.text && clauses[key].text.toLowerCase().includes('report'))
        );
    };
    
    const extractReportingFromClauses = (clauses) => {
    if (!clauses || typeof clauses !== 'object') {
        return [];
    }
    
    const reportingKeywords = ['report', 'audit', 'submit', 'deliverable', 'milestone'];
    
    return Object.entries(clauses)
        .filter(([clauseName, clauseData]) => {
        // Add null/undefined checks
        if (!clauseName || !clauseData) {
            return false;
        }
        
        const nameLower = clauseName.toLowerCase();
        const text = clauseData.text || '';
        const textLower = text.toLowerCase();
        
        return reportingKeywords.some(keyword => 
            nameLower.includes(keyword) || textLower.includes(keyword)
        );
        })
        .map(([clauseName, clauseData]) => ({
        name: clauseName,
        text: clauseData.text || '',
        category: clauseData.category || 'Reporting'
        }));
    };
    
    const dynamicSections = renderDynamicContent();
    
    return (
        <Box sx={{ mt: 3 }}>
        <Typography variant="h5" gutterBottom>
            Dynamic Contract Analysis
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
            All extracted sections from the contract. Click to expand.
        </Typography>
        
        {dynamicSections.map((section, idx) => (
            <Card key={idx} sx={{ mb: 3 }}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                {section.icon}
                <Typography variant="h6" sx={{ ml: 1 }}>
                    {section.title}
                </Typography>
                <Chip 
                    label={section.priority.toUpperCase()} 
                    size="small"
                    color={section.priority === 'high' ? 'error' : section.priority === 'medium' ? 'warning' : 'default'}
                    sx={{ ml: 2 }}
                />
                </Box>
                {section.content}
            </CardContent>
            </Card>
        ))}
        </Box>
    );
    };

    export default DynamicContractViewer;