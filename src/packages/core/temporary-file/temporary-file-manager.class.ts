import { UmbTemporaryFileRepository } from './temporary-file.repository.js';
import { UmbArrayState } from '@umbraco-cms/backoffice/observable-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbControllerBase } from '@umbraco-cms/backoffice/class-api';
import { UmbId } from '@umbraco-cms/backoffice/id';

export type TemporaryFileStatus = 'success' | 'waiting' | 'error';

export interface UmbTemporaryFileModel {
	file: File;
	unique: string;
	status: TemporaryFileStatus;
}

export interface UmbTemporaryFileQueueModel extends Partial<UmbTemporaryFileModel> {
	file: File;
}

export class UmbTemporaryFileManager extends UmbControllerBase {
	#temporaryFileRepository;

	#queue = new UmbArrayState<UmbTemporaryFileModel>([], (item) => item.unique);
	public readonly queue = this.#queue.asObservable();

	#completed = new UmbArrayState<UmbTemporaryFileModel>([], (item) => item.unique);
	public readonly completed = this.#completed.asObservable();

	constructor(host: UmbControllerHost) {
		super(host);
		this.#temporaryFileRepository = new UmbTemporaryFileRepository(host);
	}

	async uploadOne(queueItem: UmbTemporaryFileQueueModel): Promise<Array<UmbTemporaryFileModel>> {
		const item: UmbTemporaryFileModel = {
			file: queueItem.file,
			unique: queueItem.unique ?? UmbId.new(),
			status: queueItem.status ?? 'waiting',
		};
		this.#queue.appendOne(item);
		return this.handleQueue();
	}

	async upload(queueItems: Array<UmbTemporaryFileQueueModel>): Promise<Array<UmbTemporaryFileModel>> {
		const items = queueItems.map(
			(item): UmbTemporaryFileModel => ({
				file: item.file,
				unique: item.unique ?? UmbId.new(),
				status: item.status ?? 'waiting',
			}),
		);
		this.#queue.append(items);
		return this.handleQueue();
	}

	removeOne(unique: string) {
		this.#queue.removeOne(unique);
	}

	remove(uniques: Array<string>) {
		this.#queue.remove(uniques);
	}

	private async handleQueue() {
		const filesCompleted: Array<UmbTemporaryFileModel> = [];
		const queue = this.#queue.getValue();

		if (!queue.length) return filesCompleted;

		for (const item of queue) {
			if (!item.unique) throw new Error(`Unique is missing for item ${item}`);

			const { error } = await this.#temporaryFileRepository.upload(item.unique, item.file);
			await new Promise((resolve) => setTimeout(resolve, (Math.random() + 0.5) * 1000)); // simulate small delay so that the upload badge is properly shown

			if (error) {
				this.#queue.updateOne(item.unique, { ...item, status: 'error' });
			} else {
				this.#queue.updateOne(item.unique, { ...item, status: 'success' });
			}
			filesCompleted.push(item);

			this.#completed.appendOne(item);
			this.#queue.removeOne(item.unique);
		}

		return filesCompleted;
	}
}
