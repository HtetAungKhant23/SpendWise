import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/shared/prisma/prisma.service';
import { BadRequestException } from '@app/core/exceptions/bad-request.exception';
import { ExceptionConstants } from '@app/core/exceptions/constants';
import { IAccountService } from './interface/account-service.interface';
import { AccountDto } from './dto/account.dto';
import { AccountEntity } from './entity/account.entity';

@Injectable()
export class AccountService implements IAccountService {
  constructor(private readonly dbService: PrismaService) {}

  async create(userId: string, dto: AccountDto): Promise<any> {
    const existAccount = await this.dbService.account.findFirst({
      where: {
        subType: dto.subType,
        userId,
        isDeleted: false,
      },
    });

    if (existAccount) {
      throw new BadRequestException({
        message: `Account already exist`,
        code: ExceptionConstants.BadRequestCodes.RESOURCE_ALREADY_EXISTS,
      });
    }

    const account = await this.dbService.account.create({
      data: {
        name: dto.name,
        type: dto.type,
        subType: dto.subType,
        balance: dto.balance,
        userId,
      },
    });

    await this.dbService.transaction.create({
      data: {
        remark: 'account create transaction',
        description: 'account create transaction',
        amount: dto.balance,
        type: 'INCOME',
        toId: account.id,
        userId,
      },
    });
  }

  async get(userId: string): Promise<AccountEntity[]> {
    const accounts = await this.dbService.account.findMany({
      where: {
        userId,
        isDeleted: false,
      },
      include: {
        fromTransactions: {
          include: {
            category: true,
          },
        },
        toTransactions: {
          include: {
            category: true,
          },
        },
      },
    });

    return accounts.map((account) => {
      return new AccountEntity(account.id, account.name, account.type, account.subType, account.balance, undefined);
    });
  }

  async getDetail(userId: string, id: string): Promise<AccountEntity> {
    const account = await this.dbService.account.findUnique({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        fromTransactions: {
          include: {
            category: true,
          },
        },
        toTransactions: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!account) {
      throw new BadRequestException({
        message: `Account not found`,
        code: ExceptionConstants.BadRequestCodes.RESOURCE_NOT_FOUND,
      });
    }

    const transactions = [];

    for (let i = 0; i < account?.fromTransactions?.length; i += 1) {
      const fromTran = account.fromTransactions[i];
      const cate = fromTran?.category
        ? {
            id: fromTran?.category.id,
            name: fromTran?.category.name,
            icon: fromTran?.category?.icon,
          }
        : null;
      transactions.push({
        id: fromTran?.id || '',
        remark: fromTran?.remark || '',
        amount: fromTran?.amount || 0,
        type: fromTran?.type || 'INCOME',
        createdAt: fromTran?.createdAt || new Date(),
        category: cate,
      });
    }
    for (let i = 0; i < account.toTransactions.length; i += 1) {
      const toTran = account.toTransactions[i];
      const cate = toTran?.category
        ? {
            id: toTran?.category.id,
            name: toTran?.category.name,
            icon: toTran?.category?.icon,
          }
        : null;
      transactions.push({
        id: toTran?.id || '',
        remark: toTran?.remark || '',
        amount: toTran?.amount || 0,
        type: toTran?.type || 'INCOME',
        createdAt: toTran?.createdAt || new Date(),
        category: cate,
      });
    }

    return new AccountEntity(account.id, account.name, account.type, account.subType, account.balance, transactions);
  }

  async edit(id: string, name: string): Promise<void> {
    await this.dbService.account.update({
      where: {
        id,
        isDeleted: false,
      },
      data: {
        name,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.dbService.account.update({
      where: {
        id,
      },
      data: {
        isDeleted: true,
      },
    });
  }
}
