/**
 * @description       : Scheduler for Gecko Agent Swarm - runs crypto trading analysis on a schedule
 * @author            : Troy Amyett
 * @group             : AgentForce Legend
 * @last modified on  : 01-11-2026
 **/
global class GeckoScheduler implements Schedulable {

    // Default symbols to analyze
    private String symbols;

    // Default constructor - analyzes BTC, ETH, SOL
    global GeckoScheduler() {
        this.symbols = 'BTC,ETH,SOL';
    }

    // Constructor with custom symbols
    global GeckoScheduler(String symbols) {
        this.symbols = String.isBlank(symbols) ? 'BTC,ETH,SOL' : symbols;
    }

    /**
     * @description Main scheduled method that executes the Agent Swarm
     **/
    global void execute(SchedulableContext sc) {
        try {
            System.debug(LoggingLevel.INFO, 'GeckoScheduler: Starting Agent Swarm execution');
            System.debug(LoggingLevel.INFO, 'GeckoScheduler: Analyzing symbols: ' + this.symbols);

            // Execute the Agent Swarm
            GeckoSwarm.SwarmRequest request = new GeckoSwarm.SwarmRequest();
            request.symbols = this.symbols;

            List<GeckoSwarm.SwarmResult> results = GeckoSwarm.executeSwarm(
                new List<GeckoSwarm.SwarmRequest>{ request }
            );

            if (!results.isEmpty()) {
                GeckoSwarm.SwarmResult result = results[0];
                if (result.success) {
                    System.debug(LoggingLevel.INFO, 'GeckoScheduler: Swarm completed successfully');
                    System.debug(LoggingLevel.INFO, 'GeckoScheduler: ' + result.summary);

                    // Log each agent step
                    if (result.agentLogs != null) {
                        for (String logEntry : result.agentLogs) {
                            System.debug(LoggingLevel.INFO, logEntry);
                        }
                    }
                } else {
                    System.debug(LoggingLevel.ERROR, 'GeckoScheduler: Swarm failed - ' + result.errorMessage);
                }
            }

            System.debug(LoggingLevel.INFO, 'GeckoScheduler: Job completed');

        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'GeckoScheduler: Error - ' + e.getMessage());
            System.debug(LoggingLevel.ERROR, 'GeckoScheduler: Stack trace - ' + e.getStackTraceString());
        }
    }

    // ============================================
    // STATIC HELPER METHODS FOR SCHEDULING
    // ============================================

    /**
     * @description Schedules the crypto refresh job
     * @param hour Hour of day to run (0-23)
     * @param minute Minute of hour to run (0-59)
     * @param symbols Comma-separated crypto symbols to analyze
     * @return The scheduled job ID
     **/
    public static String scheduleCryptoRefresh(Integer hour, Integer minute, String symbols) {
        // Validate inputs
        if (hour == null || hour < 0 || hour > 23) {
            hour = 2; // Default to 2 AM
        }
        if (minute == null || minute < 0 || minute > 59) {
            minute = 0;
        }

        // Build cron expression: Seconds Minutes Hours DayOfMonth Month DayOfWeek Year
        String cronExp = '0 ' + minute + ' ' + hour + ' * * ?';

        GeckoScheduler scheduler = new GeckoScheduler(symbols);
        String jobName = 'GeckoSwarm_' + System.now().format('yyyyMMdd_HHmmss');

        try {
            String jobId = System.schedule(jobName, cronExp, scheduler);
            System.debug(LoggingLevel.INFO, 'Scheduled job: ' + jobName + ' with ID: ' + jobId);
            return jobId;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Failed to schedule job: ' + e.getMessage());
            return null;
        }
    }

    /**
     * @description Schedules the job to run every N minutes (for demo/testing)
     * @param intervalMinutes Minutes between runs (minimum 5)
     * @param symbols Comma-separated crypto symbols
     * @return The scheduled job ID
     **/
    public static String scheduleEveryNMinutes(Integer intervalMinutes, String symbols) {
        if (intervalMinutes == null || intervalMinutes < 5) {
            intervalMinutes = 5; // Minimum 5 minutes
        }

        // For frequent scheduling, we need to use a different approach
        // Salesforce scheduled jobs can't run more frequently than once per hour with a single job
        // So we'll schedule for the next interval from now
        Integer minute = System.now().minute();
        Integer nextMinute = ((minute / intervalMinutes) + 1) * intervalMinutes;
        if (nextMinute >= 60) {
            nextMinute = 0;
        }

        return scheduleCryptoRefresh(System.now().hour(), nextMinute, symbols);
    }

    /**
     * @description Unschedules a crypto refresh job
     * @param jobId The job ID to abort
     * @return True if successful
     **/
    public static Boolean unscheduleCryptoRefresh(String jobId) {
        if (String.isBlank(jobId)) {
            return false;
        }

        try {
            System.abortJob(jobId);
            System.debug(LoggingLevel.INFO, 'Aborted job: ' + jobId);
            return true;
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Could not abort job ' + jobId + ': ' + e.getMessage());
            return false;
        }
    }

    /**
     * @description Gets all scheduled GeckoSwarm jobs
     * @return List of job information strings
     **/
    public static List<String> getScheduledJobs() {
        List<String> jobInfos = new List<String>();

        try {
            for (CronTrigger ct : [
                SELECT Id, CronJobDetail.Name, NextFireTime, State
                FROM CronTrigger
                WHERE CronJobDetail.Name LIKE 'GeckoSwarm_%'
                ORDER BY NextFireTime
                LIMIT 50
            ]) {
                String info = ct.CronJobDetail.Name + ' | Next: ' +
                    (ct.NextFireTime != null ? ct.NextFireTime.format() : 'N/A') +
                    ' | State: ' + ct.State + ' | ID: ' + ct.Id;
                jobInfos.add(info);
            }
        } catch (Exception e) {
            jobInfos.add('Error fetching jobs: ' + e.getMessage());
        }

        return jobInfos;
    }

    /**
     * @description Manually triggers the swarm (for testing/demo)
     **/
    public static void refreshCryptoData() {
        GeckoScheduler scheduler = new GeckoScheduler();
        scheduler.execute(null);
    }

    /**
     * @description Manually triggers the swarm with custom symbols
     * @param symbols Comma-separated crypto symbols
     **/
    public static void refreshCryptoData(String symbols) {
        GeckoScheduler scheduler = new GeckoScheduler(symbols);
        scheduler.execute(null);
    }
}