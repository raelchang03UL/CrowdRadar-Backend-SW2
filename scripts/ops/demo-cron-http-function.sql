-- New project only. Installed by the reviewed private helper, initially disabled.
-- No secret literal, URL argument, response body, request header or token is logged.
CREATE FUNCTION crowdradar_demo_jobs.tick() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $function$
DECLARE
    pinned_origin CONSTANT text := __PINNED_DEMO_API_ORIGIN_SQL_LITERAL__;
    state_row crowdradar_demo_jobs.state%ROWTYPE;
    secret_value text;
    reply crowdradar_demo_http.http_response;
    payload jsonb;
    outcome text := 'HTTP_REQUEST_FAILED';
    evaluated_count integer;
    sent_count integer;
    configured_value boolean;
    failed boolean := true;
BEGIN
    IF current_database() <> 'postgres' OR current_user <> 'postgres' OR session_user <> 'postgres' THEN
        RETURN jsonb_build_object('outcome','IDENTITY_REJECTED');
    END IF;
    IF NOT pg_try_advisory_xact_lock(31001104) THEN
        RETURN jsonb_build_object('outcome','ALREADY_RUNNING');
    END IF;
    SELECT * INTO STRICT state_row FROM crowdradar_demo_jobs.state WHERE singleton FOR UPDATE;
    IF NOT state_row.enabled THEN RETURN jsonb_build_object('outcome','DISABLED'); END IF;
    IF NOT EXISTS (SELECT 1 FROM crowdradar_demo_identity.provenance
        WHERE project_ref='ycxuhejpehmdfbvdplpl' AND organization_id='uuvuyytnogzwbgikwdyy'
        AND provenance_id='9b3392c347071f6272cf401bf7563b88fc578b26b679de1a2f4d2db2a51d0cc1'
        AND creation_evidence_sha256='b17e91771b65d68d1e5a971e6dd215e550ffa6d5c333e9193bd70838101da68e')
        OR state_row.provenance_id <> '9b3392c347071f6272cf401bf7563b88fc578b26b679de1a2f4d2db2a51d0cc1'
        OR state_row.api_origin <> pinned_origin THEN
        UPDATE crowdradar_demo_jobs.state SET enabled=FALSE;
        PERFORM cron.alter_job(state_row.job_id,active := FALSE);
        RETURN jsonb_build_object('outcome','PROVENANCE_REJECTED');
    END IF;
    IF state_row.last_attempt_at > clock_timestamp()-interval '55 seconds' THEN
        RETURN jsonb_build_object('outcome','RATE_GUARD');
    END IF;
    IF state_row.retry_after > clock_timestamp() THEN
        RETURN jsonb_build_object('outcome','UNCERTAIN_RESULT_COOLDOWN');
    END IF;
    UPDATE crowdradar_demo_jobs.state SET last_attempt_at=clock_timestamp();
    BEGIN
        SELECT decrypted_secret INTO STRICT secret_value FROM vault.decrypted_secrets
            WHERE name='crowdradar-demo-push-ycxuhejpehmdfbvdplpl';
        IF length(secret_value)<32 OR length(secret_value)>256 OR secret_value ~ '[[:space:]]' THEN
            RAISE EXCEPTION 'INVALID_EXECUTOR_SECRET';
        END IF;
        IF crowdradar_demo_http.http_reset_curlopt() IS NOT TRUE
            OR crowdradar_demo_http.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','5000') IS NOT TRUE
            OR crowdradar_demo_http.http_set_curlopt('CURLOPT_TIMEOUT_MS','55000') IS NOT TRUE
            OR crowdradar_demo_http.http_set_curlopt('CURLOPT_SSL_VERIFYPEER','1') IS NOT TRUE
            OR crowdradar_demo_http.http_set_curlopt('CURLOPT_SSL_VERIFYHOST','2') IS NOT TRUE THEN
            RAISE EXCEPTION 'HTTP_OPTIONS_UNSUPPORTED';
        END IF;
        SELECT * INTO reply FROM crowdradar_demo_http.http((
            'POST',pinned_origin||'/api/internal/push/process',
            ARRAY[crowdradar_demo_http.http_header('x-saturation-event-secret',secret_value)],
            'application/json','{}')::crowdradar_demo_http.http_request);
        secret_value := NULL;
        IF reply.status=200 THEN
            payload := reply.content::jsonb;
            evaluated_count := (payload->'data'->>'evaluated')::integer;
            sent_count := (payload->'data'->>'sent')::integer;
            configured_value := (payload->'data'->>'configured')::boolean;
            IF evaluated_count IS NOT NULL AND sent_count IS NOT NULL AND configured_value IS NOT NULL
                AND evaluated_count>=0 AND sent_count>=0 THEN
                failed := FALSE; outcome := 'OK';
            ELSE outcome := 'INVALID_RESPONSE'; END IF;
        ELSE outcome := 'HTTP_STATUS'; END IF;
    EXCEPTION WHEN query_canceled OR OTHERS THEN
        secret_value := NULL;
        outcome := 'HTTP_REQUEST_FAILED';
    END;
    -- A transport exception does not cancel Vercel's maxDuration=60 handler.
    -- Wait 65 seconds AFTER that result before another attempt, skipping the
    -- next minute tick; this is not external-delivery deduplication.
    UPDATE crowdradar_demo_jobs.state SET retry_after=CASE WHEN outcome='HTTP_REQUEST_FAILED'
        THEN clock_timestamp()+interval '65 seconds' ELSE NULL END;
    -- Retry is a later minute only; no HTTP retry loop. Three consecutive errors
    -- stop the job; auth errors/observable redirects stop it on the first result.
    UPDATE crowdradar_demo_jobs.state SET failures=CASE WHEN failed THEN failures+1 ELSE 0 END;
    INSERT INTO crowdradar_demo_jobs.runs(status,outcome,evaluated,sent,configured)
        VALUES(reply.status,outcome,evaluated_count,sent_count,configured_value);
    IF reply.status IN (401,403) OR reply.status BETWEEN 300 AND 399
        OR (SELECT failures>=3 FROM crowdradar_demo_jobs.state) THEN
        UPDATE crowdradar_demo_jobs.state SET enabled=FALSE;
        PERFORM cron.alter_job(state_row.job_id,active := FALSE);
    END IF;
    DELETE FROM crowdradar_demo_jobs.runs WHERE id IN
        (SELECT id FROM crowdradar_demo_jobs.runs WHERE started_at<clock_timestamp()-interval '7 days' ORDER BY id LIMIT 500);
    DELETE FROM cron.job_run_details WHERE runid IN
        (SELECT runid FROM cron.job_run_details WHERE jobid=state_row.job_id
            AND end_time<clock_timestamp()-interval '7 days' ORDER BY runid LIMIT 500);
    RETURN jsonb_build_object('outcome',outcome,'httpStatus',reply.status,'evaluated',evaluated_count,'sent',sent_count,'configured',configured_value);
END;
$function$;
