package com.finnri.app

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class FinnriWidgetModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName(): String = "FinnriWidget"

  @ReactMethod
  fun updateMonthSpend(amount: String, month: String) {
    context.getSharedPreferences("finnri_widget", Context.MODE_PRIVATE)
      .edit()
      .putString("amount", amount)
      .putString("month", month)
      .apply()
    FinnriWidgetProvider.refresh(context)
  }
}
