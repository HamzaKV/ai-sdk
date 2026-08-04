import { describe, it, expect } from 'vitest';
import { createInMemoryStatePersistence, createJobStore, type HitlJob } from './index';

describe('createInMemoryStatePersistence', () => {
    it('stores, retrieves, and deletes values by key', async () => {
        const store = createInMemoryStatePersistence<{ foo: string }>();

        expect(await store.get('a')).toBeUndefined();

        await store.set('a', { foo: 'bar' });
        expect(await store.get('a')).toEqual({ foo: 'bar' });

        await store.delete('a');
        expect(await store.get('a')).toBeUndefined();
    });
});

describe('createJobStore', () => {
    it('creates a pending job with the given conversation state and pending tool call', async () => {
        const jobs = createJobStore(createInMemoryStatePersistence<HitlJob>());

        const job = await jobs.create({
            id: 'job_1',
            conversationState: { messages: ['hello'] },
            pendingToolCall: { toolCallId: 'call_1', name: 'getLocation', args: {} },
        });

        expect(job.status).toBe('pending');
        expect(await jobs.get('job_1')).toEqual(job);
    });

    it('approves a job and can edit the tool call args in the process', async () => {
        const jobs = createJobStore(createInMemoryStatePersistence<HitlJob>());
        await jobs.create({
            id: 'job_2',
            conversationState: {},
            pendingToolCall: { toolCallId: 'call_2', name: 'getWeather', args: { city: 'NYC' } },
        });

        const approved = await jobs.approve('job_2', { city: 'Boston' });

        expect(approved?.status).toBe('approved');
        expect(approved?.pendingToolCall.args).toEqual({ city: 'Boston' });
    });

    it('approves a job without editing args when none are given', async () => {
        const jobs = createJobStore(createInMemoryStatePersistence<HitlJob>());
        await jobs.create({
            id: 'job_3',
            conversationState: {},
            pendingToolCall: { toolCallId: 'call_3', name: 'getWeather', args: { city: 'NYC' } },
        });

        const approved = await jobs.approve('job_3');

        expect(approved?.pendingToolCall.args).toEqual({ city: 'NYC' });
    });

    it('denies a job with a reason', async () => {
        const jobs = createJobStore(createInMemoryStatePersistence<HitlJob>());
        await jobs.create({
            id: 'job_4',
            conversationState: {},
            pendingToolCall: { toolCallId: 'call_4', name: 'deleteAccount', args: {} },
        });

        const denied = await jobs.deny('job_4', 'not authorized');

        expect(denied?.status).toBe('denied');
        expect(denied?.denyReason).toBe('not authorized');
    });

    it('returns undefined when approving or denying a job that does not exist', async () => {
        const jobs = createJobStore(createInMemoryStatePersistence<HitlJob>());

        expect(await jobs.approve('missing')).toBeUndefined();
        expect(await jobs.deny('missing')).toBeUndefined();
    });
});
