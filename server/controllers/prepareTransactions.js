import crypto from "crypto";
import RequiredVaulesValidator from "../utils/requiredValuesValidator.js";
import { isUserExists, countDecimals } from "../utils/validators.js";
import redisService from "../utils/redis.service.js";
import UsersModel from "../models/UsersModel.js";

const GetNonce = async (request, response) => {
  try {
    const required = ["accountId"];
    const validRequestBody = await RequiredVaulesValidator(
      request,
      response,
      required
    );

    if (validRequestBody === true) {
      const { accountId } = request.body;
      const userAccount = await isUserExists(accountId);

      if (!userAccount) {
        return response.status(404).json({
          sucess: false,
          message: "Account not found",
        });
      }

      const nonce = crypto.randomBytes(16).toString("hex");
      await redisService.set(`${accountId}/${nonce}`, "false", 600); // key, value, ttl

      return response.status(200).json({
        success: true,
        nonce: nonce,
        message: "This nonce is valid for 10 Minutes",
      });
    }
  } catch (error) {
    return response.status(504).json({
      success: false,
      error: error.message,
    });
  }
};

const GetSignedTransaction = async (request, response) => {
  try {
    const required = [
      "senderPublicKey",
      "recipientPublicKey",
      "senderPrivateKey",
      "amount",
      "nonce",
    ];
    const validRequestBody = await RequiredVaulesValidator(
      request,
      response,
      required
    );

    if (validRequestBody === true) {
      const {
        senderPublicKey,
        recipientPublicKey,
        senderPrivateKey,
        amount,
        nonce,
      } = request.body;

      const senderAccount = await UsersModel.findOne({
        publicKey: senderPublicKey,
      });
      const receiverAccount = await UsersModel.findOne({
        publicKey: recipientPublicKey,
      });

      if (!senderAccount || !receiverAccount) {
        return response.status(404).json({
          success: false,
          message: "Sender or Recipient Acount not found",
        });
      }

      const decimalCountOfAmount = countDecimals(parseFloat(amount));

      if (decimalCountOfAmount > 2) {
        return response.status(404).json({
          success: false,
          message: "Amount Should have a maximum of 2 decimal places",
        });
      }

      const data = {
        senderAccountId: senderAccount.accountId,
        receiverAccountId: receiverAccount.accountId,
        senderPublicKey,
        recipientPublicKey,
        amount: amount,
        nonce: nonce,
      };

      const senderPrivateKeyPair = crypto.createPrivateKey(senderPrivateKey);
      const signatureGenerator = crypto.createSign("sha256");
      signatureGenerator.update(JSON.stringify(data));
      const signature = signatureGenerator.sign(senderPrivateKeyPair, "hex");

      return response.status(200).json({
        sucess: true,
        ...data,
        signature,
      });
    }
  } catch (error) {
    return response.status(504).json({
      success: false,
      error: error.message,
    });
  }
};

export { GetNonce, GetSignedTransaction };
